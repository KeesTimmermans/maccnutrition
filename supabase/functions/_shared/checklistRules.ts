/**
 * Rules for Today's checklist: item shape, validation and the built-in fallback library.
 * Pure TypeScript with no Deno imports, so the edge function and vitest share it.
 */
import { containsNutritionNumbers } from "./habitGuard.ts";

export type ChecklistMode = "habits" | "calories";
export type ChecklistWhen = "morning" | "breakfast" | "lunch" | "afternoon" | "dinner" | "evening" | "anytime";
export type ChecklistKind = "manual" | "auto" | "habit";
export type ChecklistSource = "ai" | "fallback" | "weekly_habit" | "water" | "checkin";
export type ChecklistCategory = "nutrition" | "sleep" | "stress" | "hydration";
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
  category: ChecklistCategory;
  rule?: ChecklistRule;
}

export const CHECKLIST_WHENS: ChecklistWhen[] = ["morning", "breakfast", "lunch", "afternoon", "dinner", "evening", "anytime"];
export const CHECKLIST_KINDS: ChecklistKind[] = ["manual", "auto", "habit"];
export const CHECKLIST_CATEGORIES: ChecklistCategory[] = ["nutrition", "sleep", "stress", "hydration"];

// ── Categories and the no-exercise rule ─────────────────────────────

/** Exercise actions: always rejected, whatever else the title or why says. */
export const EXERCISE_ACTION_PATTERN =
  /\b(walk(?:s|ing)?|stroll(?:s|ing)?|stretch(?:es|ing)?|yoga|pilates|cardio|hiit|reps|sets|squats?|deadlifts?|bench|jog(?:s|ging)?|steps)\b/i;
/** An instruction to train ("Hit the gym", "Finish your workout", "Go for a run"): always rejected. */
export const TRAIN_INSTRUCTION_PATTERN =
  /\b(do|complete|perform|finish|hit|crush|go for|go to|add|start)\b[^.]{0,25}\b(workout|exercise|run|gym|session|lift(?:ing)?|training)\b/i;
/** Training-timing words: allowed only next to an eating/drinking word ("a banana an hour before your run"). */
export const TRAINING_TIMING_PATTERN =
  /\b(pre-workout|post-workout|workouts?|work out|training|trains?|sessions?|gym|runs?|running|lifts?|lifting|exercis(?:e|es|ing))\b/i;
/** Eating/drinking words that make a training-timing word OK. Meal-time nouns (breakfast, lunch, dinner) deliberately don't count. */
export const EATING_DRINKING_PATTERN =
  /\b(eat(?:s|ing)?|drink(?:s|ing)?|sip(?:s|ping)?|snacks?|fuel(?:s|ling|ing)?|refuel(?:s|ling|ing)?|hydrat(?:e|ed|ing|ion)|fruits?|bananas?|oats|oatmeal|porridge|toast|rice|bagels?|yog(?:h)?urts?|shakes?|smoothies?|protein|carbs?|carbohydrates?|water|electrolytes?|sports drinks?|meals?)\b/i;

const asksToExercise = (text: string): boolean => EXERCISE_ACTION_PATTERN.test(text) || TRAIN_INSTRUCTION_PATTERN.test(text);

/**
 * True when the item asks the user to exercise: an exercise action or an instruction to train (title or why),
 * or a training-timing word with no eating/drinking word. Nutrition and hydration around training pass.
 */
export const isExerciseItem = (title: string, why = ""): boolean => {
  if (asksToExercise(title) || asksToExercise(why)) return true;
  const titleEats = EATING_DRINKING_PATTERN.test(title);
  if (TRAINING_TIMING_PATTERN.test(title) && !titleEats) return true;
  if (TRAINING_TIMING_PATTERN.test(why) && !titleEats && !EATING_DRINKING_PATTERN.test(why)) return true;
  return false;
};

// ── Nutrition and hydration around training ─────────────────────────

/** Title prefix for the one conditional training-nutrition item (we don't know which days the user trains). */
export const TRAINING_NUTRITION_PREFIX = "If you train today:";

export const isTrainingNutritionTitle = (title: string): boolean => /^\s*if you train today:/i.test(title);

/** Stored values are the onboarding option strings "0-1" | "2-3" | "4-5" | "6+". */
const TRAINING_NONE_VALUES = new Set(["0", "0-1", "none"]);
const TRAINING_SOME_VALUES = new Set(["2-3", "4-5", "6+"]);

/** True when the profile has training days set and not zero. */
export const hasTrainingDays = (trainingDays: unknown): boolean => {
  if (trainingDays === null || trainingDays === undefined) return false;
  const raw = String(trainingDays).trim().toLowerCase();
  if (raw === "" || TRAINING_NONE_VALUES.has(raw)) return false;
  if (TRAINING_SOME_VALUES.has(raw)) return true;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return Number(raw) > 0;
  return false;
};

export const isChecklistCategory = (value: unknown): value is ChecklistCategory =>
  typeof value === "string" && (CHECKLIST_CATEGORIES as string[]).includes(value);

const SLEEP_WORDS = /\b(sleep\w*|bed|bedtime|caffeine|coffee|nap|wake|lights?|bedroom)\b|screens? off|wind(?:ing)? down/i;
const STRESS_WORDS = /\b(breath\w*|calm\w*|relax\w*|stress\w*|journal\w*|write|meditat\w*|mindful\w*|screens?|phone|pause|slowly|tasks?)\b/i;
const HYDRATION_WORDS = /\b(water|hydrat\w*|drinks?|bottle|fluids?|tea|electrolytes?)\b/i;

/** Keyword classification for items without a category (old weekly habits, check-in points). Defaults to nutrition. */
export const classifyCategory = (text: string): ChecklistCategory => {
  if (SLEEP_WORDS.test(text)) return "sleep";
  if (STRESS_WORDS.test(text)) return "stress";
  if (HYDRATION_WORDS.test(text)) return "hydration";
  return "nutrition";
};

/** A saved list is stale when any item has no valid category (lists made before categories existed). */
export const isStaleChecklist = (items: unknown): boolean =>
  !Array.isArray(items) || items.some((i) => !i || typeof i !== "object" || !isChecklistCategory((i as Record<string, unknown>).category));
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
  if (!isChecklistCategory(it.category)) return { valid: false, reason: "missing or invalid category" };
  if (isExerciseItem(title, why)) return { valid: false, reason: "about workouts or exercise" };
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

export interface FallbackEntry {
  key: string;
  title: string;
  why: string;
  when: ChecklistWhen;
  kind: "manual" | "auto";
  category: ChecklistCategory;
  rule?: ChecklistRule;
  contains?: Contains[];
  /** Training-nutrition entry: only used through trainingNutritionFallback, for users with training days. */
  trainingOnly?: boolean;
}

const SHARED_SLEEP: FallbackEntry[] = [
  { key: "screens-off", title: "Screens off 30 minutes before bed", why: "Less screen light helps you fall asleep sooner.", when: "evening", kind: "manual", category: "sleep" },
  { key: "no-caffeine", title: "No caffeine after 2pm today", why: "Caffeine late in the day keeps sleep light.", when: "afternoon", kind: "manual", category: "sleep" },
  { key: "same-bedtime", title: "Go to bed at the same time as yesterday", why: "A steady bedtime makes waking up easier.", when: "evening", kind: "manual", category: "sleep" },
  { key: "phone-out", title: "Charge your phone outside the bedroom tonight", why: "No late scrolling means more real rest.", when: "evening", kind: "manual", category: "sleep" },
  { key: "dim-lights", title: "Dim the lights an hour before bed", why: "Lower light tells your body it's nearly bedtime.", when: "evening", kind: "manual", category: "sleep" },
];

const SHARED_STRESS: FallbackEntry[] = [
  { key: "five-breaths", title: "Take five slow breaths before your first meal", why: "A calm start makes it easier to eat mindfully.", when: "breakfast", kind: "manual", category: "stress" },
  { key: "lunch-no-screen", title: "Eat lunch away from your screen", why: "A real break lowers stress and helps you notice fullness.", when: "lunch", kind: "manual", category: "stress" },
  { key: "top-three", title: "Write tomorrow's top three tasks before bed", why: "Getting them on paper quietens a busy mind.", when: "evening", kind: "manual", category: "stress" },
  { key: "tea-break", title: "Take a five-minute tea break with no screens this afternoon", why: "A short pause resets an afternoon slump.", when: "afternoon", kind: "manual", category: "stress" },
];

export const FALLBACK_LIBRARY: Record<ChecklistMode, FallbackEntry[]> = {
  habits: [
    // nutrition
    { key: "h-breakfast-protein", title: "Breakfast: a palm of protein (eggs or Greek yoghurt) plus one fruit", why: "Protein early keeps you fuller until lunch.", when: "breakfast", kind: "manual", category: "nutrition", contains: ["eggs", "dairy"] },
    { key: "h-breakfast-veg", title: "Add a handful of vegetables to your breakfast", why: "An easy first portion of veg for the day.", when: "breakfast", kind: "manual", category: "nutrition" },
    { key: "h-plant-protein-lunch", title: "Add a palm of beans, lentils or tofu to lunch", why: "A simple protein base that works for any diet.", when: "lunch", kind: "manual", category: "nutrition" },
    { key: "h-log-lunch", title: "Log your lunch in the app", why: "Logging as you go keeps your diary honest.", when: "lunch", kind: "auto", category: "nutrition", rule: { type: "meal_logged", meal: "lunch" } },
    { key: "h-fruit-snack", title: "Have a piece of fruit with your afternoon snack", why: "Adds fibre and sweetness without a sugar crash.", when: "afternoon", kind: "manual", category: "nutrition" },
    { key: "h-half-plate", title: "Fill half your dinner plate with vegetables", why: "The plate method keeps dinner balanced without counting.", when: "dinner", kind: "manual", category: "nutrition" },
    { key: "h-thumb-fat", title: "Add a thumb of olive oil or avocado to dinner", why: "A little healthy fat makes the meal more satisfying.", when: "dinner", kind: "manual", category: "nutrition" },
    { key: "h-prep-lunch", title: "Prep tomorrow's lunch tonight", why: "A ready lunch beats a rushed choice tomorrow.", when: "evening", kind: "manual", category: "nutrition" },
    // hydration
    { key: "h-water-lunch", title: "Drink a glass of water before lunch", why: "Water before meals helps you notice when you're full.", when: "lunch", kind: "manual", category: "hydration" },
    { key: "h-bottle-3pm", title: "Finish a full bottle of water by 3pm", why: "Front-loading water avoids a late-day catch-up.", when: "afternoon", kind: "manual", category: "hydration" },
    { key: "h-water-wake", title: "Drink a glass of water when you wake up", why: "You wake up a little dehydrated after the night.", when: "morning", kind: "manual", category: "hydration" },
    { key: "h-swap-drink", title: "Swap one sugary drink for water today", why: "One swap a day adds up over the week.", when: "anytime", kind: "manual", category: "hydration" },
    ...SHARED_SLEEP.map((e) => ({ ...e, key: `h-${e.key}` })),
    ...SHARED_STRESS.map((e) => ({ ...e, key: `h-${e.key}` })),
    // training nutrition (only for users with training days)
    { key: "h-train-fruit", title: "If you train today: eat a piece of fruit 60–90 minutes before", why: "Easy energy without a heavy stomach.", when: "anytime", kind: "manual", category: "nutrition", trainingOnly: true },
    { key: "h-train-water", title: "If you train today: drink water steadily before, during and after", why: "Small sips keep you hydrated without feeling full.", when: "anytime", kind: "manual", category: "hydration", trainingOnly: true },
    { key: "h-train-protein", title: "If you train today: have a palm of protein within two hours after", why: "Protein after training helps your muscles recover.", when: "anytime", kind: "manual", category: "nutrition", trainingOnly: true },
    { key: "h-slow-meal", title: "Eat one meal slowly without your phone", why: "Slower meals make it easier to stop when satisfied.", when: "dinner", kind: "manual", category: "stress" },
  ],
  calories: [
    // nutrition (logging items count as nutrition here)
    { key: "c-log-breakfast", title: "Log breakfast before 11 am", why: "An early log gives the rest of the day a head start.", when: "breakfast", kind: "auto", category: "nutrition", rule: { type: "meal_logged", meal: "breakfast" } },
    { key: "c-breakfast-protein", title: "Have eggs or Greek yoghurt with breakfast", why: "A protein-rich start keeps hunger steady.", when: "breakfast", kind: "manual", category: "nutrition", contains: ["eggs", "dairy"] },
    { key: "c-log-lunch", title: "Log your lunch in the app", why: "Logging straight away keeps your numbers accurate.", when: "lunch", kind: "auto", category: "nutrition", rule: { type: "meal_logged", meal: "lunch" } },
    { key: "c-protein-every-meal", title: "Add a protein source to every meal today", why: "Spreading protein out makes your target easier.", when: "anytime", kind: "manual", category: "nutrition" },
    { key: "c-log-every-meal", title: "Log every meal straight after eating", why: "Memory fades fast — log while it's fresh.", when: "anytime", kind: "manual", category: "nutrition" },
    { key: "c-fruit-snack", title: "Have fruit instead of a sweet snack this afternoon", why: "Same sweetness, more fibre, fewer surprises.", when: "afternoon", kind: "manual", category: "nutrition" },
    { key: "c-half-plate", title: "Fill half your dinner plate with vegetables", why: "Volume without a big change to your numbers.", when: "dinner", kind: "manual", category: "nutrition" },
    { key: "c-log-dinner", title: "Log your dinner before bed", why: "A complete day gives you a true picture.", when: "dinner", kind: "auto", category: "nutrition", rule: { type: "meal_logged", meal: "dinner" } },
    { key: "c-plan-tomorrow", title: "Plan tomorrow's meals in the app tonight", why: "A plan makes tomorrow's choices automatic.", when: "evening", kind: "manual", category: "nutrition" },
    // hydration
    { key: "c-water-meals", title: "Drink a glass of water before each meal", why: "Helps you tell thirst from hunger.", when: "anytime", kind: "manual", category: "hydration" },
    { key: "c-bottle-3pm", title: "Finish a full bottle of water by 3pm", why: "Front-loading water avoids a late-day catch-up.", when: "afternoon", kind: "manual", category: "hydration" },
    { key: "c-water-wake", title: "Drink a glass of water when you wake up", why: "You wake up a little dehydrated after the night.", when: "morning", kind: "manual", category: "hydration" },
    { key: "c-swap-drink", title: "Swap one sugary drink for water today", why: "Saves easy calories without feeling hungrier.", when: "anytime", kind: "manual", category: "hydration" },
    // training nutrition (only for users with training days)
    { key: "c-train-fruit", title: "If you train today: eat a piece of fruit 60–90 minutes before", why: "Quick carbs give you energy without a heavy stomach.", when: "anytime", kind: "manual", category: "nutrition", trainingOnly: true },
    { key: "c-train-water", title: "If you train today: drink water steadily before, during and after", why: "Small sips keep you hydrated without feeling full.", when: "anytime", kind: "manual", category: "hydration", trainingOnly: true },
    { key: "c-train-meal", title: "If you train today: eat a protein-rich meal within two hours after", why: "Protein and a proper meal help you recover.", when: "anytime", kind: "manual", category: "nutrition", trainingOnly: true },
    ...SHARED_SLEEP.map((e) => ({ ...e, key: `c-${e.key}` })),
    ...SHARED_STRESS.map((e) => ({ ...e, key: `c-${e.key}` })),
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

const isCalm = (c: ChecklistCategory) => c === "sleep" || c === "stress";

/** Most AI/fallback nutrition items allowed per list (habits mode); calories mode has no cap. */
export const MAX_NUTRITION_ITEMS: Record<ChecklistMode, number> = { habits: 3, calories: Infinity };

export interface FallbackOptions {
  /** Items already chosen for the AI/fallback slots (counted for the category mix). */
  chosen?: Pick<ChecklistItem, "category">[];
  /** Which calm category to add when the list still has no sleep or stress item. */
  preferCalm?: "sleep" | "stress";
  /** The user's weakest area, picked first when it fits. */
  prefer?: ChecklistCategory | null;
}

const toFallbackItem = (e: FallbackEntry): ChecklistItem => ({
  id: `fb-${e.key}`,
  title: e.title,
  why: e.why,
  when: e.when,
  kind: e.kind,
  source: "fallback",
  category: e.category,
  ...(e.rule ? { rule: e.rule } : {}),
});

/**
 * Picks `count` fallback items that fit the user's diet, allergies and dislikes, skipping titles already on the list,
 * and keeping the category mix: at least one sleep or stress item, nutrition capped in habits mode, categories spread out.
 */
export const pickFallbacks = (
  mode: ChecklistMode,
  count: number,
  profile: DietProfile,
  existingTitles: string[] = [],
  options: FallbackOptions = {},
): ChecklistItem[] => {
  if (count <= 0) return [];
  const excluded = excludedContents(profile);
  const dislikes = (profile.foodDislikes || "")
    .split(/[,;\n]/)
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length >= 3);
  const taken = new Set(existingTitles.map(normalize));
  const pool = FALLBACK_LIBRARY[mode].filter(
    (e) =>
      !e.trainingOnly &&
      !(e.contains || []).some((c) => excluded.has(c)) &&
      !dislikes.some((d) => e.title.toLowerCase().includes(d)) &&
      !taken.has(normalize(e.title)),
  );

  const chosenCats = (options.chosen || []).map((c) => c.category);
  const picked: FallbackEntry[] = [];
  const cats = () => [...chosenCats, ...picked.map((p) => p.category)];
  const countOf = (c: ChecklistCategory) => cats().filter((x) => x === c).length;
  const canTake = (e: FallbackEntry) =>
    !picked.includes(e) && (e.category !== "nutrition" || countOf("nutrition") < MAX_NUTRITION_ITEMS[mode]);
  const takeFrom = (category: ChecklistCategory) => {
    const e = pool.find((p) => p.category === category && canTake(p));
    if (e) picked.push(e);
    return !!e;
  };

  // 1. Guarantee a sleep or stress item.
  if (!cats().some(isCalm)) {
    const first = options.preferCalm ?? (options.prefer && isCalm(options.prefer) ? options.prefer : "sleep");
    if (!takeFrom(first)) takeFrom(first === "sleep" ? "stress" : "sleep");
  }
  // 2. The weakest area next.
  if (picked.length < count && options.prefer && countOf(options.prefer) === 0) takeFrom(options.prefer);
  // 3. Spread the rest: always top up the least-used category.
  while (picked.length < count) {
    const order = [...CHECKLIST_CATEGORIES].sort((a, b) => countOf(a) - countOf(b));
    if (!order.some((c) => takeFrom(c))) break;
  }
  return picked.slice(0, count).map(toFallbackItem);
};

/**
 * Applies the category mix to the valid AI items: caps nutrition in habits mode and, when no sleep or stress item
 * is present, frees the last slot so a fallback can supply one. Returns the AI items to keep.
 */
export const applyCategoryMix = <T extends { category: ChecklistCategory }>(
  aiItems: T[],
  mode: ChecklistMode,
  needed: number,
): T[] => {
  let nutrition = 0;
  const kept = aiItems.filter((i) => {
    if (i.category !== "nutrition") return true;
    nutrition += 1;
    return nutrition <= MAX_NUTRITION_ITEMS[mode];
  }).slice(0, needed);
  if (needed > 0 && kept.length > 0 && !kept.some((i) => isCalm(i.category)) && kept.length >= needed) {
    // Drop the last nutrition (or else hydration) item to make room for a sleep/stress fallback.
    const idx = [...kept].reverse().findIndex((i) => i.category === "nutrition");
    const dropAt = idx >= 0 ? kept.length - 1 - idx : kept.length - 1;
    kept.splice(dropAt, 1);
  }
  return kept;
};

/** The first training-nutrition fallback not already on the list, keeping the habits-mode nutrition cap. */
export const trainingNutritionFallback = (
  mode: ChecklistMode,
  existingTitles: string[] = [],
  chosen: Pick<ChecklistItem, "category">[] = [],
): ChecklistItem | null => {
  const taken = new Set(existingTitles.map(normalize));
  const nutritionFull = chosen.filter((c) => c.category === "nutrition").length >= MAX_NUTRITION_ITEMS[mode];
  const entry = FALLBACK_LIBRARY[mode].find(
    (e) => e.trainingOnly && !taken.has(normalize(e.title)) && !(nutritionFull && e.category === "nutrition"),
  );
  return entry ? toFallbackItem(entry) : null;
};

/**
 * Exactly one "If you train today:" item for users with training days, none otherwise.
 * Keeps the first AI training item (nutrition or hydration) or adds a fallback one, making room by dropping the
 * last non-calm item (a nutrition one when the habits-mode cap would be exceeded). Never exceeds `needed`.
 */
export const applyTrainingNutritionRule = (
  items: ChecklistItem[],
  opts: {
    mode: ChecklistMode;
    needed: number;
    hasTraining: boolean;
    existingTitles?: string[];
    isTraining?: (item: ChecklistItem) => boolean;
  },
): ChecklistItem[] => {
  const isTraining = (i: ChecklistItem) => isTrainingNutritionTitle(i.title) || !!opts.isTraining?.(i);
  const rest = items.filter((i) => !isTraining(i));
  if (!opts.hasTraining || opts.needed <= 0) return rest.slice(0, Math.max(0, opts.needed));
  const fromAi = items.find((i) => isTraining(i) && (i.category === "nutrition" || i.category === "hydration"));
  const training =
    fromAi ?? trainingNutritionFallback(opts.mode, [...(opts.existingTitles || []), ...rest.map((i) => i.title)], rest);
  if (!training) return rest.slice(0, opts.needed);

  const dropLast = (pred: (i: ChecklistItem) => boolean) => {
    for (let k = rest.length - 1; k >= 0; k -= 1) {
      if (pred(rest[k])) {
        rest.splice(k, 1);
        return true;
      }
    }
    return false;
  };
  if (training.category === "nutrition") {
    while (rest.filter((i) => i.category === "nutrition").length >= MAX_NUTRITION_ITEMS[opts.mode]) {
      if (!dropLast((i) => i.category === "nutrition")) break;
    }
  }
  while (rest.length >= opts.needed) {
    if (!dropLast((i) => !isCalm(i.category))) dropLast(() => true);
  }
  return [...rest, training];
};

/** The user's weakest area from today's check-in (1–5 scales; higher stress is worse). */
export const weakestArea = (
  checkin: { sleep_quality?: number | null; stress_level?: number | null; energy_level?: number | null } | null | undefined,
): ChecklistCategory | null => {
  if (!checkin) return null;
  const sleep = checkin.sleep_quality ?? null;
  const stress = checkin.stress_level ?? null;
  const energy = checkin.energy_level ?? null;
  const scores: { c: ChecklistCategory; bad: number }[] = [];
  if (sleep != null && sleep <= 2) scores.push({ c: "sleep", bad: 3 - sleep });
  if (stress != null && stress >= 4) scores.push({ c: "stress", bad: stress - 3 });
  if (energy != null && energy <= 2) scores.push({ c: "hydration", bad: 3 - energy - 0.5 });
  scores.sort((a, b) => b.bad - a.bad);
  return scores[0]?.c ?? null;
};

export interface WeeklyHabitLike {
  habit_title: string;
  habit_description: string;
  category?: string | null;
}

/** A weekly habit's category: the stored one, else keyword-classified. */
export const weeklyHabitCategory = (habit: WeeklyHabitLike): ChecklistCategory =>
  isChecklistCategory(habit.category) ? habit.category : classifyCategory(`${habit.habit_title} ${habit.habit_description}`);

/** The items every list starts with: the water goal, and this week's habit when there is one (never a workout habit). */
export const deterministicItems = (habit?: WeeklyHabitLike | null): ChecklistItem[] => {
  const items: ChecklistItem[] = [
    { id: "water", title: "Reach your water goal today", when: "anytime", kind: "auto", source: "water", category: "hydration", rule: { type: "water_goal" } },
  ];
  if (habit?.habit_title && !isExerciseItem(habit.habit_title, habit.habit_description || "")) {
    items.push({
      id: "weekly-habit",
      title: habit.habit_title,
      why: habit.habit_description ? habit.habit_description.slice(0, 200) : undefined,
      when: "anytime",
      kind: "habit",
      source: "weekly_habit",
      category: weeklyHabitCategory(habit),
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
  category: raw.category as ChecklistCategory,
  ...(raw.kind === "auto" && raw.rule ? { rule: raw.rule as ChecklistRule } : {}),
});
