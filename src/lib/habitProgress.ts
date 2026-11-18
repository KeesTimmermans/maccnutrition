import { format } from "date-fns";

/**
 * Number-free progress figures for the "simple habits" food approach.
 * Pure helpers: they count meals and water days, never calories or macros.
 * Days are matched by the user's local calendar date.
 */

export interface LoggedAt {
  logged_at: string;
}

export interface WaterEntry extends LoggedAt {
  amount_ml: number;
}

export interface MealsPerDay {
  /** yyyy-MM-dd (local) */
  dateKey: string;
  /** Short label for charts, e.g. "Mon" or "Nov 3" */
  label: string;
  meals: number;
}

const localDateKey = (value: string | Date) => format(new Date(value), "yyyy-MM-dd");

/** Count of meals logged on each of the given days, in the order given. */
export const mealsPerDay = (
  meals: LoggedAt[],
  days: Date[],
  labelFormat: string = "EEE",
): MealsPerDay[] => {
  const counts = new Map<string, number>();
  for (const meal of meals) {
    const key = localDateKey(meal.logged_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((day) => {
    const dateKey = localDateKey(day);
    return { dateKey, label: format(day, labelFormat), meals: counts.get(dateKey) ?? 0 };
  });
};

/** How many of the given days have at least one meal logged. */
export const daysWithMealsLogged = (meals: LoggedAt[], days: Date[]): number =>
  mealsPerDay(meals, days).filter((d) => d.meals > 0).length;

/** How many of the given days reached the water goal (total ml ≥ goal). A goal of 0 or less counts no days. */
export const daysWaterGoalMet = (water: WaterEntry[], days: Date[], goalMl: number): number => {
  if (!(goalMl > 0)) return 0;
  const totals = new Map<string, number>();
  for (const entry of water) {
    const key = localDateKey(entry.logged_at);
    totals.set(key, (totals.get(key) ?? 0) + (entry.amount_ml || 0));
  }
  return days.filter((day) => (totals.get(localDateKey(day)) ?? 0) >= goalMl).length;
};

export interface CurrentTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * The check-in "adjustment" for habits mode: zero change, so no new targets are written.
 * Shaped like progressAdjustment's AdjustmentResult so it can be persisted the same way.
 */
export const unchangedTargetsAdjustment = (targets: CurrentTargets) => ({
  newCalories: targets.calories,
  newProtein: targets.protein,
  newCarbs: targets.carbs,
  newFats: targets.fats,
  deltaCalories: 0,
  baselineCalories: targets.calories,
  reason: "",
});
