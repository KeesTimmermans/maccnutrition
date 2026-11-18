/**
 * Rules for Today's checklist: item shape, validation and the built-in fallback library.
 * Pure TypeScript with no Deno imports, so the edge function and vitest share it.
 */
import { containsNutritionNumbers } from "./habitGuard.ts";

export type ChecklistMode = "habits" | "calories";
export type ChecklistWhen = "morning" | "breakfast" | "lunch" | "afternoon" | "dinner" | "evening" | "anytime";
export type ChecklistKind = "manual" | "auto" | "habit";
export type ChecklistSource = "ai" | "fallback" | "weekly_habit" | "water" | "checkin";
export type ChecklistRule =
  | { type: "water_goal" }
  | { type: "meal_logged"; meal: "breakfast" | "lunch" | "dinner" | "any" }
  | { type: "checkin_done" }
  | { type: "protein_by_hour"; grams: number; hour: number };

export interface ChecklistItem {
  id: string;
  title: string;
  why?: string;
  when: ChecklistWhen;
  kind: ChecklistKind;
  source: ChecklistSource;
  rule?: ChecklistRule;
}

export const CHECKLIST_WHENS: ChecklistWhen[] = ["morning", "breakfast", "lunch", "afternoon", "dinner", "evening", "anytime"];
export const CHECKLIST_KINDS: ChecklistKind[] = ["manual", "auto", "habit"];
const MEALS = ["breakfast", "lunch", "dinner", "any"];

/** Total items per day (deterministic + AI/fallback). */
export const CHECKLIST_SIZE: Record<ChecklistMode, number> = { habits: 6, calories: 4 };

const VAGUE =
  /\b(focus(?:ing)? on|maximi[sz]e|optimi[sz]e|prioriti[sz]e|improve|try to|aim to|consider|be mindful|work on|ensure|enhance)\b/i;
const CALORIE_NUMBER = /\d+\s?(?:k?cals?|kilocalories?|calories?)\b/i;

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const isValidRule = (rule: unknown, mode: ChecklistMode): boolean => {
  if (!rule || typeof rule !== "object") return false;
  const r = rule as Record<string, unknown>;
  switch (r.type) {
    case "water_goal":
    case "checkin_done":
      return true;
    case "meal_logged":
      return typeof r.meal === "string" && MEALS.includes(r.meal);
    case "protein_by_hour":
      return (
        mode === "calories" &&
        typeof r.grams === "number" && r.grams >= 5 && r.grams <= 200 &&
        typeof r.hour === "number" && Number.isInteger(r.hour) && r.hour >= 6 && r.hour <= 22
      );
    default:
      return false;
  }
};

/** Rejects vague, malformed or (in habits mode) number-carrying items. */
export const validateChecklistItem = (item: unknown, mode: ChecklistMode): ValidationResult => {
  if (!item || typeof item !== "object") return { valid: false, reason: "not an object" };
  const it = item as Record<string, unknown>;
  const title = typeof it.title === "string" ? it.title.trim() : "";
  const why = typeof it.why === "string" ? it.why.trim() : "";

  if (!title) return { valid: false, reason: "missing title" };
  if (title.split(/\s+/).filter(Boolean).length < 4) return { valid: false, reason: "title under 4 words" };
  if (title.length > 80) return { valid: false, reason: "title over 80 characters" };
  if (why.length > 90) return { valid: false, reason: "why over 90 characters" };
  if (VAGUE.test(title)) return { valid: false, reason: "vague wording without a concrete action" };
  if (typeof it.when !== "string" || !CHECKLIST_WHENS.includes(it.when as ChecklistWhen)) {
    return { valid: false, reason: "invalid when" };
  }
  if (typeof it.kind !== "string" || !CHECKLIST_KINDS.includes(it.kind as ChecklistKind)) {
    return { valid: false, reason: "invalid kind" };
  }
  if (it.kind === "auto") {
    if (!isValidRule(it.rule, mode)) return { valid: false, reason: "invalid rule" };
    if (mode === "habits" && (it.rule as ChecklistRule).type === "protein_by_hour") {
      return { valid: false, reason: "protein rule not allowed in habits mode" };
    }
  } else if (it.rule != null) {
    return { valid: false, reason: "rule on a non-auto item" };
  }
  if (mode === "habits" && containsNutritionNumbers(`${title}. ${why}`)) {
    return { valid: false, reason: "mentions calories, macros, grams or targets" };
  }
  if (mode === "calories" && CALORIE_NUMBER.test(`${title}. ${why}`)) {
    return { valid: false, reason: "invents a calorie number" };
  }
  return { valid: true };
};

// ── Fallback library ────────────────────────────────────────────────

/** What a fallback item contains, so it can be skipped for a diet, allergy or dislike. */
type Contains = "meat" | "fish" | "eggs" | "dairy" | "gluten" | "nuts";

interface FallbackEntry {
  key: string;
  title: string;
  why: string;
  when: ChecklistWhen;
  kind: "manual" | "auto";
  rule?: ChecklistRule;
  contains?: Contains[];
}

export const FALLBACK_LIBRARY: Record<ChecklistMode, FallbackEntry[]> = {
  habits: [
    { key: "h-breakfast-protein", title: "Breakfast: a palm of protein (eggs or Greek yoghurt) plus one fruit", why: "Protein early keeps you fuller until lunch.", when: "breakfast", kind: "manual", contains: ["eggs", "dairy"] },
    { key: "h-breakfast-veg", title: "Add a handful of vegetables to your breakfast", why: "An easy first portion of veg for the day.", when: "breakfast", kind: "manual" },
    { key: "h-water-lunch", title: "Drink a glass of water before lunch", why: "Water before meals helps you notice when you're full.", when: "lunch", kind: "manual" },
    { key: "h-plant-protein-lunch", title: "Add a palm of beans, lentils or tofu to lunch", why: "A simple protein base that works for any diet.", when: "lunch", kind: "manual" },
    { key: "h-slow-meal", title: "Eat one meal slowly, without your phone", why: "Slower meals make it easier to stop when satisfied.", when: "lunch", kind: "manual" },
    { key: "h-log-lunch", title: "Log your lunch in the app", why: "Logging as you go keeps your diary honest.", when: "lunch", kind: "auto", rule: { type: "meal_logged", meal: "lunch" } },
    { key: "h-fruit-snack", title: "Have a piece of fruit with your afternoon snack", why: "Adds fibre and sweetness without a sugar crash.", when: "afternoon", kind: "manual" },
    { key: "h-swap-drink", title: "Swap one sugary drink for water today", why: "One swap a day adds up over the week.", when: "anytime", kind: "manual" },
    { key: "h-half-plate", title: "Fill half your dinner plate with vegetables", why: "The plate method keeps dinner balanced without counting.", when: "dinner", kind: "manual" },
    { key: "h-thumb-fat", title: "Add a thumb of olive oil or avocado to dinner", why: "A little healthy fat makes the meal more satisfying.", when: "dinner", kind: "manual" },
    { key: "h-stop-full", title: "Stop eating dinner when you feel about 80% full", why: "Pausing before you're stuffed is a habit you can feel.", when: "dinner", kind: "manual" },
    { key: "h-log-dinner", title: "Log your dinner before bed", why: "A complete diary shows your real patterns.", when: "dinner", kind: "auto", rule: { type: "meal_logged", meal: "dinner" } },
    { key: "h-walk", title: "Take a 10-minute walk after dinner", why: "Gentle movement after eating helps digestion and sleep.", when: "evening", kind: "manual" },
    { key: "h-prep-lunch", title: "Prep tomorrow's lunch tonight", why: "A ready lunch beats a rushed choice tomorrow.", when: "evening", kind: "manual" },
    { key: "h-screens-off", title: "Screens off 30 minutes before bed", why: "Better sleep makes tomorrow's food choices easier.", when: "evening", kind: "manual" },
  ],
  calories: [
    { key: "c-log-breakfast", title: "Log breakfast before 10 am", why: "An early log sets up the rest of the day.", when: "breakfast", kind: "auto", rule: { type: "meal_logged", meal: "breakfast" } },
    { key: "c-breakfast-protein", title: "Have eggs or Greek yoghurt with breakfast", why: "A protein-rich start keeps hunger steady.", when: "breakfast", kind: "manual", contains: ["eggs", "dairy"] },
    { key: "c-log-lunch", title: "Log your lunch in the app", why: "Logging straight away keeps your numbers accurate.", when: "lunch", kind: "auto", rule: { type: "meal_logged", meal: "lunch" } },
    { key: "c-water-meals", title: "Drink a glass of water before each meal", why: "Helps you tell thirst from hunger.", when: "anytime", kind: "manual" },
    { key: "c-protein-every-meal", title: "Add a protein source to every meal today", why: "Spreading protein out makes your target easier.", when: "anytime", kind: "manual" },
    { key: "c-log-every-meal", title: "Log every meal straight after eating", why: "Memory fades fast — log while it's fresh.", when: "anytime", kind: "manual" },
    { key: "c-fruit-snack", title: "Have fruit instead of a sweet snack this afternoon", why: "Same sweetness, more fibre, fewer surprises.", when: "afternoon", kind: "manual" },
    { key: "c-half-plate", title: "Fill half your dinner plate with vegetables", why: "Volume without a big change to your numbers.", when: "dinner", kind: "manual" },
    { key: "c-log-dinner", title: "Log your dinner before bed", why: "A complete day gives you a true picture.", when: "dinner", kind: "auto", rule: { type: "meal_logged", meal: "dinner" } },
    { key: "c-plan-tomorrow", title: "Plan tomorrow's meals in the app tonight", why: "A plan makes tomorrow's choices automatic.", when: "evening", kind: "manual" },
    { key: "c-prep-lunch", title: "Prep tomorrow's lunch tonight", why: "A ready lunch is easy to log and hard to skip.", when: "evening", kind: "manual" },
    { key: "c-walk", title: "Take a 10-minute walk after dinner", why: "Easy movement that helps digestion.", when: "evening", kind: "manual" },
    { key: "c-screens-off", title: "Screens off 30 minutes before bed", why: "Good sleep keeps appetite in check tomorrow.", when: "evening", kind: "manual" },
  ],
};

export interface DietProfile {
  dietType?: string | null;
  allergies?: string[] | null;
  foodDislikes?: string | null;
}

const excludedContents = (profile: DietProfile): Set<Contains> => {
  const out = new Set<Contains>();
  const diet = (profile.dietType || "").toLowerCase();
  if (diet === "vegetarian") ["meat", "fish"].forEach((c) => out.add(c as Contains));
  if (diet === "vegan") ["meat", "fish", "eggs", "dairy"].forEach((c) => out.add(c as Contains));
  if (diet === "pescatarian") out.add("meat");
  if (diet === "dairy_free") out.add("dairy");
  if (diet === "gluten_free") out.add("gluten");
  for (const allergy of profile.allergies || []) {
    const a = allergy.toLowerCase();
    if (/nut|peanut/.test(a)) out.add("nuts");
    if (/egg/.test(a)) out.add("eggs");
    if (/dairy|milk|lactose/.test(a)) out.add("dairy");
    if (/gluten|wheat|coeliac|celiac/.test(a)) out.add("gluten");
    if (/fish|shellfish|seafood/.test(a)) out.add("fish");
  }
  return out;
};

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Picks fallback items that fit the user's diet, allergies and dislikes, skipping titles already on the list. */
export const pickFallbacks = (
  mode: ChecklistMode,
  count: number,
  profile: DietProfile,
  existingTitles: string[] = [],
): ChecklistItem[] => {
  if (count <= 0) return [];
  const excluded = excludedContents(profile);
  const dislikes = (profile.foodDislikes || "")
    .split(/[,;\n]/)
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length >= 3);
  const taken = new Set(existingTitles.map(normalize));
  const fits = (e: FallbackEntry) =>
    !(e.contains || []).some((c) => excluded.has(c)) &&
    !dislikes.some((d) => e.title.toLowerCase().includes(d)) &&
    !taken.has(normalize(e.title));

  // Spread picks across the day: take every n-th entry first, then fill in order.
  const pool = FALLBACK_LIBRARY[mode].filter(fits);
  const step = Math.max(1, Math.floor(pool.length / count));
  const picked: FallbackEntry[] = [];
  for (let i = 0; i < pool.length && picked.length < count; i += step) picked.push(pool[i]);
  for (const e of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked.map((e) => ({
    id: `fb-${e.key}`,
    title: e.title,
    why: e.why,
    when: e.when,
    kind: e.kind,
    source: "fallback" as const,
    ...(e.rule ? { rule: e.rule } : {}),
  }));
};

/** The items every list starts with: the water goal, and this week's habit when there is one. */
export const deterministicItems = (habit?: { habit_title: string; habit_description: string } | null): ChecklistItem[] => {
  const items: ChecklistItem[] = [
    { id: "water", title: "Reach your water goal today", when: "anytime", kind: "auto", source: "water", rule: { type: "water_goal" } },
  ];
  if (habit?.habit_title) {
    items.push({
      id: "weekly-habit",
      title: habit.habit_title,
      why: habit.habit_description ? habit.habit_description.slice(0, 200) : undefined,
      when: "anytime",
      kind: "habit",
      source: "weekly_habit",
    });
  }
  return items;
};

/** Turns a raw AI item into a checklist item (no validation — call validateChecklistItem first). */
export const toAiItem = (raw: Record<string, unknown>, index: number): ChecklistItem => ({
  id: `ai-${index + 1}`,
  title: String(raw.title).trim(),
  ...(typeof raw.why === "string" && raw.why.trim() ? { why: raw.why.trim() } : {}),
  when: raw.when as ChecklistWhen,
  kind: raw.kind as ChecklistKind,
  source: "ai",
  ...(raw.kind === "auto" && raw.rule ? { rule: raw.rule as ChecklistRule } : {}),
});
