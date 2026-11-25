/** Nutrition Score check-in: questions, scoring, retake timing and tips. Pure: no React or Supabase. */

export const ANSWER_MIN = 1;
export const ANSWER_MAX = 5;
export const RETAKE_DAYS = 30;
export const GOAL_STEP = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AreaId =
  | "veg_fruit" | "protein" | "fibre" | "whole_foods_sugar" | "drinks" | "eating_pattern" | "sleep_stress";

export interface Area { id: AreaId; name: string; questionIds: string[] }

export const AREAS: Area[] = [
  { id: "veg_fruit", name: "Veg & fruit", questionIds: ["q1", "q2"] },
  { id: "protein", name: "Protein", questionIds: ["q3", "q4"] },
  { id: "fibre", name: "Fibre", questionIds: ["q5", "q6"] },
  { id: "whole_foods_sugar", name: "Whole foods & sugar", questionIds: ["q7", "q8", "q9"] },
  { id: "drinks", name: "Drinks", questionIds: ["q10", "q11"] },
  { id: "eating_pattern", name: "Eating pattern", questionIds: ["q12", "q13", "q14"] },
  { id: "sleep_stress", name: "Sleep & stress", questionIds: ["q15", "q16"] },
];

export interface Question { id: string; area: AreaId; text: string; options: [string, string, string, string, string] }

const FREQ: Question["options"] = ["Never", "Rarely", "Sometimes", "Often", "Almost always"];

export const QUESTIONS: Question[] = [
  { id: "q1", area: "veg_fruit", text: "Portions of veg on a typical day (a portion is about a fist)", options: ["None", "1", "2-3", "4", "5 or more"] },
  { id: "q2", area: "veg_fruit", text: "Pieces of fruit on a typical day", options: ["Rarely or never", "A few times a week", "One most days", "Two a day", "Three or more"] },
  { id: "q3", area: "protein", text: "How many of your meals and snacks include a decent protein (meat, fish, eggs, dairy, beans, tofu, nuts)?", options: ["Hardly any", "One a day", "Two a day", "Most", "Every meal and snack"] },
  { id: "q4", area: "protein", text: "How many different protein foods do you eat in a typical week (for example chicken, eggs, beans, tofu, dairy, fish)?", options: ["One", "Two", "Three", "Four", "Five or more"] },
  { id: "q5", area: "fibre", text: "High-fibre foods such as berries, pears, apples with skin, broccoli, oats or wholegrain bread, rice or pasta", options: FREQ },
  { id: "q6", area: "fibre", text: "Nuts, seeds, beans, lentils or chickpeas", options: FREQ },
  { id: "q7", area: "whole_foods_sugar", text: "Roughly what share of what you eat in a day is whole food (fruit, veg, meat, fish, eggs, plain dairy, beans, nuts, oats, potatoes)?", options: ["Under 50%", "50-65%", "65-80%", "80-90%", "90-100%"] },
  { id: "q8", area: "whole_foods_sugar", text: "Ready meals, takeaways or fast food", options: ["Every day", "5-6 times a week", "4 times a week", "3 times a week", "1-2 times a week or less"] },
  { id: "q9", area: "whole_foods_sugar", text: "Sweets, biscuits, cakes or chocolate", options: ["Several times a day", "Daily", "A few times a week", "Once a week", "Rarely or never"] },
  { id: "q10", area: "drinks", text: "Sugary drinks, juice or sweetened coffees", options: ["Several a day", "About one a day", "A few a week", "Once a week or less", "Rarely or never"] },
  { id: "q11", area: "drinks", text: "Water and unsweetened drinks per day", options: ["Under 1 litre", "1-1.5 litres", "1.5-2 litres", "2-2.5 litres", "2.5-3 litres or more"] },
  { id: "q12", area: "eating_pattern", text: "Skipping meals, or going 5+ hours awake without eating", options: ["Most days", "Several times a week", "About once a week", "Rarely", "Never"] },
  { id: "q13", area: "eating_pattern", text: "Planning or prepping meals ahead for the week", options: FREQ },
  { id: "q14", area: "eating_pattern", text: "How often do you know exactly what you'll eat tomorrow?", options: FREQ },
  { id: "q15", area: "sleep_stress", text: "How often do you wake up feeling rested?", options: ["Never", "Rarely", "Sometimes", "Usually", "Almost always"] },
  { id: "q16", area: "sleep_stress", text: "Your stress levels over the past month", options: ["Overwhelmed most days", "High", "Moderate", "Low", "Very low and calm"] },
];

export type BandId = "getting_started" | "building" | "strong" | "excellent";
/** Lowest score for each band, ascending. */
export const BANDS: { min: number; id: BandId; name: string }[] = [
  { min: 0, id: "getting_started", name: "Getting started" },
  { min: 40, id: "building", name: "Building" },
  { min: 60, id: "strong", name: "Strong" },
  { min: 80, id: "excellent", name: "Excellent" },
];

export const bandFor = (score: number) =>
  [...BANDS].reverse().find((b) => score >= b.min) ?? BANDS[0];

export type Answers = Record<string, number>;
export type AreaScores = Record<AreaId, number>;

export interface ScoreResult { total: number; areas: AreaScores; band: BandId; focusArea: AreaId }

export const isComplete = (answers: Answers, ids = QUESTIONS.map((q) => q.id)) =>
  ids.every((id) => Number.isInteger(answers[id]) && answers[id] >= ANSWER_MIN && answers[id] <= ANSWER_MAX);

export function scoreAnswers(answers: Answers): ScoreResult {
  if (!isComplete(answers)) throw new Error("Incomplete or out-of-range answers");
  const sum = QUESTIONS.reduce((s, q) => s + answers[q.id], 0);
  const n = QUESTIONS.length;
  const total = Math.round(((sum - n) / ((ANSWER_MAX - ANSWER_MIN) * n)) * 100);
  const areas = {} as AreaScores;
  for (const a of AREAS) {
    const k = a.questionIds.length;
    const s = a.questionIds.reduce((t, id) => t + answers[id], 0);
    areas[a.id] = Math.round(((s - k) / ((ANSWER_MAX - ANSWER_MIN) * k)) * 100);
  }
  let focusArea = AREAS[0].id;
  for (const a of AREAS) if (areas[a.id] < areas[focusArea]) focusArea = a.id;
  return { total, areas, band: bandFor(total).id, focusArea };
}

export interface ScoreSnapshot { total: number; areas: AreaScores }

export function compareScores(previous: ScoreSnapshot, current: ScoreSnapshot) {
  const areas = {} as AreaScores;
  for (const a of AREAS) areas[a.id] = (current.areas[a.id] ?? 0) - (previous.areas[a.id] ?? 0);
  return { overall: current.total - previous.total, areas };
}

export const retakeUnlockAt = (takenAt: Date) => new Date(takenAt.getTime() + RETAKE_DAYS * DAY_MS);

export const daysUntilRetake = (takenAt: Date, now: Date) =>
  Math.max(0, Math.ceil((retakeUnlockAt(takenAt).getTime() - now.getTime()) / DAY_MS));

export const isRetakeUnlocked = (takenAt: Date, now: Date) => now >= retakeUnlockAt(takenAt);

export const goalScore = (total: number) => Math.min(100, total + GOAL_STEP);

export const FOCUS_TIPS: Record<AreaId, [string, string]> = {
  veg_fruit: ["Add one handful of veg to your biggest meal today.", "Keep washed fruit where you'll see it, and grab a piece with your afternoon drink."],
  protein: ["Add a protein to your next snack: yoghurt, eggs, a handful of nuts or cheese.", "Try one new protein this week, such as beans, tofu, fish or a different cut of meat."],
  fibre: ["Add berries to breakfast: fresh, frozen or stirred into oats.", "Swap one refined carb this week for a wholegrain version."],
  whole_foods_sugar: ["Pick one ready meal or takeaway night this week and cook something simple from whole ingredients instead.", "Keep sweet treats for after a meal rather than between meals."],
  drinks: ["Fill a 1-litre bottle in the morning and aim to finish it by lunch.", "Swap one sugary drink a day for water, sparkling water or unsweetened tea."],
  eating_pattern: ["Decide tomorrow's three meals tonight, in under two minutes.", "Set a reminder to eat something at regular points through your day."],
  sleep_stress: ["Pick a wind-down time tonight and put your phone down 30 minutes before.", "Take five slow breaths before your next meal."],
};

/** Tip for the given result number (1 = first result). */
export const focusTip = (area: AreaId, resultCount: number) =>
  FOCUS_TIPS[area][(Math.max(1, resultCount) - 1) % 2];

export const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
