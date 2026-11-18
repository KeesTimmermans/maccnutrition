/**
 * Prompt pieces for users on the "simple habits" food approach (user_baselines.tracking_mode = 'habits').
 * Calorie-tracking users never reach this file: their prompt text stays exactly as written in index.ts.
 * Pure TypeScript (no Deno imports) so a vitest test can check it.
 */

export const HABIT_MODE_BLOCK = `━━━ HABIT MODE — READ FIRST ━━━
This client does NOT track calories or macros. Never mention calories, kcal, macros, grams of protein/carbs/fat, targets, deficits/surpluses, percentages of anything nutritional, or counting/weighing food. Coach with specific, doable habits: the plate method (half vegetables, a quarter protein, a quarter carbs), hand portions (a palm of protein, a fist of carbs, a thumb of fats), protein at every meal, vegetables at two meals, water before meals, regular meal times, eating slowly, planning tomorrow's lunch, sleep and stress habits. Be precise, not vague: name the food, the portion in hand-sizes, and the meal or time. Never say 'focus on', 'optimise' or 'maximise' without the exact action. If they ask for calories, macros or numbers, say kindly that they chose the habit approach, give a qualitative answer, and mention they can switch in Settings → Food approach. Ignore any numbers in earlier messages of this conversation and never repeat them.
Water amounts in litres or glasses are fine; gram weights only ever appear inside the meal_suggestion JSON block, never in your sentences.`;

/** Goal handling without numbers. */
export const habitGoalGuidance = (primaryGoal: string | null | undefined): string => {
  const goal = (primaryGoal || "").toLowerCase().replace(/_/g, " ");
  if (goal.includes("fat loss") || goal.includes("weight loss") || goal.includes("lose")) {
    return `GOAL HABITS (fat loss, no numbers): stop eating at about 80% full, swap sugary drinks for water, and build every meal on a base of protein plus vegetables (a palm of protein, two handfuls of vegetables).`;
  }
  if (goal.includes("muscle") || goal.includes("gain") || goal.includes("bulk")) {
    return `GOAL HABITS (muscle gain, no numbers): add a protein + carb snack (e.g. Greek yoghurt with a banana), eat 4 meals a day, and have a palm of protein at each one.`;
  }
  return `GOAL HABITS (general health, no numbers): consistency and variety — regular meal times, a palm of protein and vegetables at most meals, and a new vegetable or fruit each week.`;
};

export const HABIT_FINAL_RULE = `FINAL RULE — HABIT MODE:
No calories, kcal, macros, nutrient grams, targets, deficits, surpluses or nutrition percentages anywhere in your sentences. Use hand portions and plain actions instead.`;

/** Sent once when a habits-mode reply still mentions nutrition numbers. */
export const HABIT_RETRY_INSTRUCTION = `Rewrite your last reply for this client, who uses the simple habits approach. Remove every mention of calories, kcal, macros, grams of protein/carbs/fat/sugar, targets, deficits, surpluses and nutrition percentages — use hand portions (a palm of protein, a fist of carbs, a thumb of fats) and plain actions instead. Keep the same advice, tone, language and length. Keep any ---DAILY_FOCUS--- or ---FOCUS_POINTS--- section with its markers, with number-free points. If your reply had a \`\`\`json meal_suggestion block, copy it back unchanged at the very end. Return only the rewritten reply.`;

type Replacement = [string | RegExp, string];

/** Swaps the calorie-centred lines of the core prompt for habit versions. Every target must exist (see habitPrompt.test.ts). */
export const HABIT_CORE_REPLACEMENTS: Replacement[] = [
  [
    "- Each meal is auto-analysed for calories, protein, carbs, and fats using our nutrition database cascade.",
    "- Each logged meal is saved to their food diary, so they can see their eating patterns.",
  ],
  [
    "- Rest-day and training-day hydration targets are calculated automatically.",
    "- A daily water amount is suggested automatically (rest days and training days).",
  ],
  [
    "- Nutrition targets may be auto-adjusted based on this review.",
    "- The review is about habits, energy and how they feel; it never changes their plan behind their back.",
  ],
  [/NUTRITION TARGETS \(in-app\):\n[^\n]*\n[^\n]*\n[^\n]*\n\n/, ""],
  [
    "- The app generates weekly meal plans aligned with the user's targets.",
    "- The app generates weekly meal plans built around their goal and food preferences.",
  ],
  [
    "log meals → hit targets → check-in → adjust plan.",
    "log meals → build habits → check-in → pick the next habit.",
  ],
  ["the app will estimate macros for you.", "the app fills in the details for you."],
  [
    /When the user says they are SHORT ON PROTEIN \(or any macro\) today:\n[^\n]*\n[^\n]*/,
    `When the user asks how to eat more PROTEIN:
→ Coach with hand portions: a palm of protein at every meal (two palms for bigger appetites), and log the next meal in the app.
→ Name 3 options that fit their diet type (e.g., Greek yogurt, eggs, chicken breast — or tofu/tempeh/lentils for vegetarians), and say which meal each one goes in.`,
  ],
  [
    "→ Reference the in-app water tracker and their daily target.",
    "→ Reference the in-app water tracker and their daily water amount.",
  ],
  [
    "2. Write 1-3 short sentences first (the idea and why it fits their remaining numbers), then put the JSON block LAST in the message.",
    "2. Write 1-3 short sentences first (what the meal is and why it fits, with hand-size portions and NO numbers in the sentences), then put the JSON block LAST in the message.",
  ],
  [
    /Give specific, actionable guidance covering the full day\.[^\n]*\n\nExample: "For today, I want you to prioritize protein early[^\n]*/,
    `Give specific, actionable guidance covering the full day. Weave together breakfast/morning habits, water, and evening considerations, with hand portions and named foods — never calories, macros or grams. This is the practical core.

Example: "For today, start with a palm of protein at breakfast — eggs or Greek yogurt, or a shake if that's easier. That steadies energy far better than another coffee. Keep a bottle of water on your desk and have a glass before each meal, because dehydration makes tired days feel worse. At dinner, build the plate: half vegetables, a quarter protein, a quarter potatoes or rice. And since sleep was rough, try winding down 30 minutes earlier tonight."`,
  ],
  [
    "🥩 Hit 120g protein — prioritize breakfast & dinner\n→ Add eggs or Greek yogurt to breakfast, lean meat at dinner",
    "🥩 A palm of protein at breakfast and dinner\n→ Eggs or Greek yogurt in the morning, chicken or lentils tonight",
  ],
  [
    "- Don't give generic advice — use their actual targets and goals",
    "- Don't give generic advice — use their actual goals and habits",
  ],
];

/** Swaps target-based guidance in the progress check-in context for behaviour-based guidance. */
export const HABIT_PROGRESS_REPLACEMENTS: Replacement[] = [
  [
    "wants to push harder and progress more - they're ready for increased intensity or stricter targets",
    "wants to push harder and progress more - they're ready for a bigger habit step",
  ],
  [
    "Any target changes have already been calculated by the app — acknowledge them, never recalculate them.",
    "They use the simple habits approach, so nothing about their plan has changed — coach the next habit step instead.",
  ],
  [
    "provide specific actionable steps to intensify (e.g., tighten calorie target, increase protein, add training)",
    "provide specific habit steps to step up (e.g., a palm of protein at every meal, vegetables at two meals, a glass of water before each meal, planning tomorrow's lunch tonight)",
  ],
  [
    "💪 [Second actionable focus - related to their targets]",
    "💪 [Second actionable focus - one specific eating habit: the food, the hand-size portion and the meal]",
  ],
  [
    "- Actionable and measurable where possible",
    "- Actionable and checkable each day (yes/no), with no calories, macros, grams or targets",
  ],
];

export const applyReplacements = (
  text: string,
  replacements: Replacement[],
  onMiss?: (from: string | RegExp) => void,
): string =>
  replacements.reduce((acc, [from, to]) => {
    const next = acc.replace(from as string, to);
    if (next === acc) onMiss?.(from);
    return next;
  }, text);

/** Cycle-phase advice without calorie or macro percentages: energy, training, sleep and food types. */
export const habitCycleDirective = (phase: string): string => {
  const directives: Record<string, string> = {
    menstrual: `CYCLE PHASE COACHING — MENSTRUAL:
- Comfort, warmth and consistency come first. Suggest iron-rich foods (red meat, lentils, spinach) and a warm, protein-based meal.
- Keep water and a pinch-of-salt drink nearby; gentle movement is fine — do NOT push intensity.
- Tone: supportive and practical.`,
    follicular: `CYCLE PHASE COACHING — FOLLICULAR:
- Energy is typically rising — encourage productive training and regular, structured meals.
- A fist of carbs (oats, rice, potatoes) around training helps sessions feel good.`,
    ovulation: `CYCLE PHASE COACHING — OVULATION:
- Energy is often highest — encourage high-intensity training if they are up for it.
- If hunger is higher, an extra protein + carb snack is fine (optional, not a rule). Encourage water with electrolytes.`,
    luteal: `CYCLE PHASE COACHING — LUTEAL:
- Cravings and hunger often rise — suggest prepared snacks (Greek yoghurt, fruit, a handful of nuts) to avoid unplanned snacking.
- Magnesium-rich foods (dark chocolate, nuts, leafy greens), water and an earlier wind-down for sleep.`,
  };
  const directive = directives[phase];
  if (!directive) return "";
  return `${directive}

IMPORTANT CYCLE COACHING RULES:
- Do NOT present cycle advice as medical advice or claim cycle tracking is diagnostic.
- Keep advice practical, with named foods and hand portions — no calorie or macro numbers.`;
};

/** Competition prep in habit mode keeps event, date, phase and mode, and drops every calorie/macro line. */
export const dropCompPrepNutritionLines = (section: string): string =>
  section
    .split("\n")
    .filter((line) => !/calori|kcal|macro|carb|deficit|surplus|target|weekly loss/i.test(line))
    .join("\n");
