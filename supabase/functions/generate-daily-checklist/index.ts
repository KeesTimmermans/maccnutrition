import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { generateChatCompletion } from "npm:@lovable.dev/ai-gateway@0.1.13";
import { isHabitTrackingMode } from "../_shared/habitGuard.ts";
import {
  CHECKLIST_SIZE,
  CHECKLIST_WHENS,
  deterministicItems,
  pickFallbacks,
  toAiItem,
  validateChecklistItem,
  type ChecklistItem,
  type ChecklistMode,
} from "../_shared/checklistRules.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').refine(
    (d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d,
    'date is not a real calendar date',
  ),
  language: z.string().max(10).optional(),
  proteinTarget: z.number().optional(),
});

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', it: 'Italian', pt: 'Portuguese' };

/** Monday of the week containing `date` (YYYY-MM-DD). */
const mondayOf = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
};

const CHECKLIST_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_daily_checklist',
    description: "Return today's checklist items.",
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Imperative, one concrete action, max 80 characters.' },
              why: { type: 'string', description: 'One short line, max 90 characters.' },
              when: { type: 'string', enum: CHECKLIST_WHENS },
              kind: { type: 'string', enum: ['manual', 'auto'] },
              rule: {
                type: 'object',
                description: "Only when kind is 'auto'.",
                properties: {
                  type: { type: 'string', enum: ['meal_logged', 'protein_by_hour'] },
                  meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
                  grams: { type: 'number' },
                  hour: { type: 'number' },
                },
                required: ['type'],
              },
            },
            required: ['title', 'why', 'when', 'kind'],
          },
        },
      },
      required: ['items'],
    },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth (same pattern as generate-weekly-habit) ─────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { date, language } = parsed.data;

    // ── Existing list for this day? Return it unchanged ──────────
    const { data: existing } = await supabase
      .from('daily_checklists')
      .select('*')
      .eq('user_id', user.id)
      .eq('checklist_date', date)
      .maybeSingle();
    if (existing) return json({ checklist: existing, generated: false });

    // ── Profile + mode (server-side; any error = calories) ───────
    const { data: baseline, error: baselineErr } = await supabase
      .from('user_baselines')
      .select('tracking_mode, primary_goal, secondary_goals, diet_type, allergies, food_dislikes, training_days, job_activity_level, cooking_skill, meal_prep_time, meals_per_day, preferred_language')
      .eq('user_id', user.id)
      .maybeSingle();
    if (baselineErr) console.error('baseline lookup error:', baselineErr.message);
    const mode: ChecklistMode = !baselineErr && isHabitTrackingMode(baseline?.tracking_mode) ? 'habits' : 'calories';
    const proteinTarget = mode === 'calories' && typeof parsed.data.proteinTarget === 'number' &&
      parsed.data.proteinTarget >= 20 && parsed.data.proteinTarget <= 400
      ? Math.round(parsed.data.proteinTarget)
      : null;

    const [habitRes, checkinRes, mealsRes, focusRes] = await Promise.all([
      supabase.from('weekly_habits').select('habit_title, habit_description')
        .eq('user_id', user.id).eq('week_start_date', mondayOf(date)).maybeSingle(),
      supabase.from('daily_checkins').select('energy_level, sleep_quality, stress_level')
        .eq('user_id', user.id).eq('check_in_date', date).maybeSingle(),
      supabase.from('meals').select('name').eq('user_id', user.id)
        .order('logged_at', { ascending: false }).limit(10),
      supabase.from('progress_updates').select('coaching_focus_points, created_at').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const habit = habitRes.data ?? null;
    const baseItems = deterministicItems(habit);
    const needed = Math.max(0, CHECKLIST_SIZE[mode] - baseItems.length);

    // Same rule as the Coach card's "Your Monthly Focus": the latest progress check-in, if within 14 days.
    const focusRow = focusRes.data;
    const focusFresh = focusRow && (Date.now() - new Date(focusRow.created_at).getTime()) / 86400000 <= 14;
    const monthlyFocus: string[] = focusFresh && Array.isArray(focusRow.coaching_focus_points)
      ? (focusRow.coaching_focus_points as { text?: string }[]).map((p) => p?.text || '').filter(Boolean)
      : [];

    const profile = {
      dietType: baseline?.diet_type ?? null,
      allergies: baseline?.allergies ?? [],
      foodDislikes: baseline?.food_dislikes ?? null,
    };

    let aiItems: ChecklistItem[] = [];
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (needed > 0 && LOVABLE_API_KEY) {
      const lang = LANGUAGE_NAMES[language || baseline?.preferred_language || 'en'] || 'English';
      const modeRules = mode === 'habits'
        ? `HABITS MODE: this person does NOT track calories or macros. Items must contain NO calories, kcal, macros, grams of nutrients, targets or percentages. Use hand portions (a palm of protein, a fist of carbs, a thumb of fats, a cupped hand), the plate method (half vegetables, a quarter protein, a quarter carbs) and plain actions. kind is 'manual', except meal-logging items where natural ("Log your lunch"), which are kind 'auto' with rule {"type":"meal_logged","meal":"breakfast"|"lunch"|"dinner"}.`
        : `CALORIES MODE: numbers are allowed, but the ONLY number you may use is the protein target${proteinTarget ? ` (${proteinTarget} g protein per day)` : ''}. Never invent calorie or macro numbers. kind is 'manual', or 'auto' for meal logging with rule {"type":"meal_logged","meal":"breakfast"|"lunch"|"dinner"}.${proteinTarget ? ` You may add at most ONE auto item with rule {"type":"protein_by_hour","grams":N,"hour":H} (e.g. 30 g protein by 10), with N well below ${proteinTarget}.` : ''}`;

      const systemPrompt = `You are Coach Mac. Write today's checklist: exactly ${needed} items the user can do and tick off TODAY.
Rules:
- Every item is ONE specific action that names the concrete food, portion, time or count. Good: "Breakfast: a palm of protein (eggs or Greek yoghurt) plus one fruit", "10-minute walk after dinner", "Prep tomorrow's lunch tonight", "Screens off 30 minutes before bed", "Add one extra set to your first compound lift".
- Never use vague wording: no "focus on", "maximise", "optimise", "prioritise", "improve", "try to", "aim to", "consider", "be mindful", "work on", "ensure", "enhance".
- Turn each monthly focus point into a concrete action for today; never copy a vague focus point verbatim.
- Do not repeat the water goal or the weekly habit; they are already on the list.
- Titles are imperative, at least 4 words, max 80 characters. "why" is one short line, max 90 characters.
- Respect the diet type, allergies and dislikes. Mix times of day ("when"). Not medical advice.
- ${modeRules}
- Write the title and why in ${lang}.`;

      const checkin = checkinRes.data;
      const userPrompt = JSON.stringify({
        primaryGoal: baseline?.primary_goal ?? null,
        secondaryGoals: baseline?.secondary_goals ?? [],
        dietType: profile.dietType,
        allergies: profile.allergies,
        foodDislikes: profile.foodDislikes,
        trainingDaysPerWeek: baseline?.training_days ?? null,
        jobActivity: baseline?.job_activity_level ?? null,
        cookingSkill: baseline?.cooking_skill ?? null,
        mealPrepTime: baseline?.meal_prep_time ?? null,
        mealsPerDay: baseline?.meals_per_day ?? null,
        monthlyFocusPoints: monthlyFocus,
        todaysCheckIn: checkin ? { energy: checkin.energy_level, sleep: checkin.sleep_quality, stress: checkin.stress_level } : null,
        weeklyHabit: habit?.habit_title ?? null,
        recentMeals: (mealsRes.data ?? []).map((m: { name: string }) => m.name),
      });

      const askModel = async (extra?: string): Promise<Record<string, unknown>[]> => {
        const messages: { role: 'system' | 'user'; content: string }[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User context (JSON):\n${userPrompt}` },
        ];
        if (extra) messages.push({ role: 'user', content: extra });
        const result = await generateChatCompletion({
          model: 'google/gemini-2.5-flash',
          messages,
          tools: [CHECKLIST_TOOL],
          tool_choice: { type: 'function', function: { name: 'create_daily_checklist' } },
          max_tokens: 3000,
          reasoning_effort: 'low',
        });
        // deno-lint-ignore no-explicit-any
        const call = (result as any)?.choices?.[0]?.message?.tool_calls?.[0];
        const args = call?.function?.arguments;
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        return Array.isArray(parsedArgs?.items) ? parsedArgs.items : [];
      };

      const check = (raw: Record<string, unknown>[]) => {
        const valid: Record<string, unknown>[] = [];
        const rejected: { title: string; reason: string }[] = [];
        for (const r of raw) {
          const res = validateChecklistItem(r, mode);
          if (res.valid) valid.push(r);
          else rejected.push({ title: String(r?.title ?? ''), reason: res.reason || 'invalid' });
        }
        return { valid, rejected };
      };

      try {
        let { valid, rejected } = check(await askModel());
        if (rejected.length > 0) {
          console.log('[checklist] rejected items, retrying once:', JSON.stringify(rejected));
          const retry = check(await askModel(
            `These items were rejected:\n${rejected.map((r) => `- "${r.title}": ${r.reason}`).join('\n')}\nReturn the full list again with exactly ${needed} items that follow every rule.`,
          ));
          // Keep the better of the two attempts; whatever is still invalid is dropped.
          if (retry.valid.length >= valid.length) valid = retry.valid;
        }
        const seen = new Set(baseItems.map((i) => i.title.toLowerCase()));
        let proteinRules = 0;
        aiItems = valid
          .filter((r) => {
            // At most one protein-by-hour item, only with a protein target and never above it.
            const rule = r.rule as { type?: string; grams?: number } | undefined;
            if (r.kind === 'auto' && rule?.type === 'protein_by_hour') {
              if (!proteinTarget || (rule.grams ?? 0) > proteinTarget || proteinRules >= 1) return false;
              proteinRules += 1;
            }
            const key = String(r.title).trim().toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, needed)
          .map((r, i) => toAiItem(r, i));
      } catch (aiError) {
        console.error('[checklist] AI generation failed, using fallbacks:', aiError);
        aiItems = [];
      }
    } else if (needed > 0) {
      console.error('LOVABLE_API_KEY is not configured — using fallback items');
    }

    const items: ChecklistItem[] = [
      ...baseItems,
      ...aiItems,
      ...pickFallbacks(mode, needed - aiItems.length, profile, [...baseItems, ...aiItems].map((i) => i.title)),
    ];

    // ── Insert once; concurrent calls end up with the same row ───
    const { error: insertError } = await supabase
      .from('daily_checklists')
      .upsert(
        { user_id: user.id, checklist_date: date, items },
        { onConflict: 'user_id,checklist_date', ignoreDuplicates: true },
      );
    if (insertError) {
      console.error('Failed to save daily checklist:', insertError);
      return json({ error: "Couldn't save today's checklist." }, 500);
    }

    const { data: saved } = await supabase
      .from('daily_checklists')
      .select('*')
      .eq('user_id', user.id)
      .eq('checklist_date', date)
      .maybeSingle();

    return json({ checklist: saved, generated: true, mode });
  } catch (error) {
    console.error('generate-daily-checklist error:', error);
    return json({ error: "Something went wrong building today's checklist." }, 500);
  }
});
