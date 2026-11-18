import { mealSlotForHour } from "@/lib/dailyChecklist";

/**
 * "What should I eat next?" for the simple-habits food approach.
 * Pure helper: picks a fixed, number-free tip from the time of day and which meal slots are logged.
 * Keys match the i18n keys; the English text is the source.
 */

export type MealSlot = "breakfast" | "lunch" | "dinner";
export type NextMealId = "breakfast" | "lunch" | "dinner" | "all_logged" | "between" | "wind_down";

export const WHAT_NEXT_TEXT = {
  what_next_headline_breakfast: "No breakfast logged yet",
  what_next_headline_lunch: "No lunch logged yet",
  what_next_headline_dinner: "No dinner logged yet",
  what_next_headline_all_logged: "All your meals are logged",
  what_next_headline_between: "Between meals",
  what_next_headline_wind_down: "Winding down for the day",
  what_next_tip_breakfast: "Start with a palm of protein and a piece of fruit.",
  what_next_tip_plate: "Build your plate: half vegetables, a palm of protein, a fist of carbs, a thumb of fats.",
  what_next_tip_plate_evening:
    "Build your dinner plate: half vegetables, a palm of protein, a fist of carbs, a thumb of fats. Keep it simple tonight.",
  what_next_tip_snack: "Hungry later? A palm of protein with some fruit works well, then water before bed.",
  what_next_prefill: "Give me a quick idea for my next meal using the plate method",
} as const;

export type WhatNextTextKey = keyof typeof WHAT_NEXT_TEXT;

export interface NextMealTip {
  id: NextMealId;
  headlineKey: WhatNextTextKey;
  tipKey: WhatNextTextKey;
  headline: string;
  tip: string;
}

/** Meal slots already logged today, from each meal's local logged hour (same slots as the checklist). */
export const loggedMealSlots = (loggedHours: number[]): MealSlot[] => [
  ...new Set(loggedHours.map((h) => mealSlotForHour(h))),
];

export function pickNextMealTip(
  hour: number,
  mealsLoggedToday: number,
  mealSlotsLogged: MealSlot[],
): NextMealTip {
  const has = (slot: MealSlot) => mealSlotsLogged.includes(slot);
  let id: NextMealId;
  let tipKey: WhatNextTextKey;
  if (hour < 11 && !has("breakfast")) {
    id = "breakfast";
    tipKey = "what_next_tip_breakfast";
  } else if (hour >= 11 && hour < 16 && !has("lunch")) {
    id = "lunch";
    tipKey = "what_next_tip_plate";
  } else if (hour >= 16 && hour < 22 && !has("dinner")) {
    id = "dinner";
    tipKey = "what_next_tip_plate_evening";
  } else {
    const allLogged = mealsLoggedToday > 0 && has("breakfast") && has("lunch") && has("dinner");
    id = allLogged ? "all_logged" : hour >= 21 || hour < 5 ? "wind_down" : "between";
    tipKey = "what_next_tip_snack";
  }
  const headlineKey = `what_next_headline_${id}` as WhatNextTextKey;
  return { id, headlineKey, tipKey, headline: WHAT_NEXT_TEXT[headlineKey], tip: WHAT_NEXT_TEXT[tipKey] };
}
