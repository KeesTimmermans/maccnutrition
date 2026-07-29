import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Accepts the same userContext shape ai-coach uses (buildEdgeFunctionUserContext).
// Only the fields relevant to habit generation are validated; the rest pass through.
const userContextSchema = z.object({
  userName: z.string().max(100).nullish(),
  primaryGoal: z.string().max(100).nullish(),
  secondaryGoals: z.array(z.string().max(100)).max(10).nullish(),
  sex: z.string().max(20).nullish(),
  age: z.number().min(1).max(150).nullish(),
  activityLevel: z.string().max(50).nullish(),
  trainingDays: z.string().max(20).nullish(),
  trainingIntensity: z.string().max(50).nullish(),
  trainingDuration: z.string().max(50).nullish(),
  workoutTypes: z.array(z.string().max(50)).max(10).nullish(),
  jobActivityLevel: z.string().max(50).nullish(),
  climate: z.string().max(50).nullish(),
  sleepHours: z.string().max(20).nullish(),
  stressLevel: z.string().max(50).nullish(),
  occupation: z.string().max(100).nullish(),
  targetCalories: z.number().min(0).max(20000).nullish(),
  proteinGrams: z.number().min(0).max(1000).nullish(),
  carbsGrams: z.number().min(0).max(2000).nullish(),
  fatsGrams: z.number().min(0).max(1000).nullish(),
  waterLiters: z.number().min(0).max(20).nullish(),
  dietType: z.string().max(50).nullish(),
  foodDislikes: z.string().max(500).nullish(),
  allergies: z.array(z.string().max(100)).max(20).nullish(),
  conditions: z.array(z.string().max(100)).max(20).nullish(),
  coachingTone: z.string().max(50).nullish(),
  focusPoints: z.array(z.string().max(100)).max(10).nullish(),
  mealsPerDay: z.string().max(20).nullish(),
  mealPrepTime: z.string().max(50).nullish(),
  cookingSkill: z.string().max(50).nullish(),
  eatingSpeed: z.string().max(50).nullish(),
  hungerPatterns: z.string().max(100).nullish(),
  cravingsTriggers: z.array(z.string().max(100)).max(20).nullish(),
  emotionalEating: z.string().max(100).nullish(),
  snackingHabits: z.string().max(100).nullish(),
  hydrationHabits: z.string().max(100).nullish(),
  energyPatterns: z.string().max(100).nullish(),
  biggestChallenge: z.string().max(200).nullish(),
  pastDiets: z.array(z.string().max(100)).max(20).nullish(),
  weekendHabits: z.string().max(100).nullish(),
  eatingOutFrequency: z.string().max(50).nullish(),
  motivationStyle: z.string().max(50).nullish(),
  accountabilityPreference: z.string().max(50).nullish(),
  preferredLanguage: z.enum(['en', 'fr', 'es', 'it', 'pt']).nullish(),
}).passthrough();

const bodySchema = z.object({
  userContext: userContextSchema.nullish(),
});

/** Monday of the current week, in YYYY-MM-DD. */
function currentWeekMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

const FALLBACK_HABIT = {
  title: "Hit your protein target at breakfast",
  description: "Include at least 25-30g of protein in your first meal of the day, every day this week.",
  difficultyLabel: "Starter",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth (same pattern as ai-coach) ──────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userContext = parsed.data.userContext ?? {};

    const weekStart = currentWeekMonday();

    // ── Existing habit for this week? Return it, don't regenerate ─
    const { data: existing } = await supabase
      .from('weekly_habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ habit: existing, generated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Previous habit + completion count ────────────────────────
    const { data: previous } = await supabase
      .from('weekly_habits')
      .select('id, habit_title, habit_description, difficulty_label, completed_dates')
      .eq('user_id', user.id)
      .lt('week_start_date', weekStart)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousCompletions = previous?.completed_dates?.length ?? 0;

    let habit = { ...FALLBACK_HABIT };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY) {
      try {
        const progression = previous
          ? previousCompletions >= 6
            ? `Last week they completed the habit on ${previousCompletions} of 7 days. Make this week's habit meaningfully HARDER than last week's — a clear step up in demand, while staying realistic.`
            : `Last week they completed the habit on ${previousCompletions} of 7 days. Do NOT automatically escalate. Use judgement: if they were close (4-5 days), keep the same overall difficulty with a fresh, clearer habit; if they fell well short (0-3 days), make it easier and more achievable.`
          : `They have no previous habit. Generate a sensible starting-point habit for their goal — concrete and easy to succeed at in week one.`;

        const previousBlock = previous
          ? `Last week's habit:\n- Title: ${previous.habit_title}\n- Description: ${previous.habit_description}\n- Difficulty: ${previous.difficulty_label ?? 'unknown'}\n- Completed: ${previousCompletions}/7 days`
          : 'No previous habit.';

        const systemPrompt = `You are Coach Mac, a nutrition and habit coach.
Generate exactly ONE weekly habit for the user: a single, specific, concrete action they can check off once per day, every day, for 7 days.

Rules:
- It must be directly relevant to their primary goal and real behaviour data.
- It must be binary and checkable ("did I do this today? yes/no"). No vague advice like "eat healthier".
- Keep the title under 60 characters. Keep the description to 1-2 short sentences explaining what to do and why it helps.
- difficultyLabel is one short word or phrase, e.g. "Starter", "Steady", "Step up", "Challenging".
- Respect any allergies, conditions, diet type and dislikes.
- Never give medical advice and never restate or change their calorie/macro targets.

Progression rule: ${progression}

Respond with JSON only, in this exact shape:
{"title": "...", "description": "...", "difficultyLabel": "..."}`;

        const userPrompt = `User context (JSON):\n${JSON.stringify(userContext)}\n\n${previousBlock}`;

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          console.error('AI gateway error:', response.status, await response.text());
        } else {
          const data = await response.json();
          const raw = data?.choices?.[0]?.message?.content ?? '';
          const cleaned = raw.replace(/```json|```/g, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const parsedHabit = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
          if (parsedHabit?.title && parsedHabit?.description) {
            habit = {
              title: String(parsedHabit.title).slice(0, 120),
              description: String(parsedHabit.description).slice(0, 500),
              difficultyLabel: parsedHabit.difficultyLabel
                ? String(parsedHabit.difficultyLabel).slice(0, 40)
                : null,
            } as typeof habit;
          }
        }
      } catch (aiError) {
        console.error('Habit generation failed, using fallback:', aiError);
      }
    } else {
      console.error('LOVABLE_API_KEY is not configured — using fallback habit');
    }

    // ── Upsert (no-op if another request already created this week) ─
    const { data: inserted, error: insertError } = await supabase
      .from('weekly_habits')
      .upsert({
        user_id: user.id,
        week_start_date: weekStart,
        habit_title: habit.title,
        habit_description: habit.description,
        difficulty_label: habit.difficultyLabel ?? null,
        previous_habit_id: previous?.id ?? null,
      }, { onConflict: 'user_id,week_start_date', ignoreDuplicates: true })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Failed to save weekly habit:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to save your weekly habit.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (inserted) {
      return new Response(JSON.stringify({ habit: inserted, generated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Race: a row already existed — fetch and return it
    const { data: raced } = await supabase
      .from('weekly_habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle();

    return new Response(JSON.stringify({ habit: raced, generated: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('generate-weekly-habit error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong generating your weekly habit.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
