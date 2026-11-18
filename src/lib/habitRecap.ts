import { addDays, format } from "date-fns";
import {
  isItemDone,
  itemCategory,
  type ChecklistCategory,
  type ChecklistCompleted,
  type ChecklistDayMeal,
  type ChecklistItem,
} from "@/lib/dailyChecklist";
import { metricFor, type RecapMetric } from "@/lib/weeklyRecap";

/**
 * Number-free weekly recap for the "simple habits" food approach.
 * Pure helpers: counts of checklist items, logged days, water days and habit days. Never calories or macros.
 * All wording comes from the fixed HABIT_RECAP_TEXT library (keys match the i18n keys).
 */

export const HABIT_RECAP_CATEGORY_ORDER: ChecklistCategory[] = ["nutrition", "sleep", "stress", "hydration"];

export const HABIT_RECAP_TEXT = {
  habit_recap_win_nutrition: "Your eating habits were your strongest area this week.",
  habit_recap_win_sleep: "Your sleep routine was your strongest habit this week.",
  habit_recap_win_stress: "Your calm-down habits were your strongest area this week.",
  habit_recap_win_hydration: "Staying hydrated was your strongest habit this week.",
  habit_recap_win_habit: "You kept your weekly habit going on most days.",
  habit_recap_win_logged_most: "You logged your meals on most days this week.",
  habit_recap_win_logged_some: "Showing up counts: you logged meals on several days.",
  habit_recap_win_start: "You're here, and that's the first step.",
  habit_recap_focus_nutrition: "Add a palm of protein to breakfast every day.",
  habit_recap_focus_sleep: "Pick a bedtime and keep it within 30 minutes all week.",
  habit_recap_focus_stress: "Take five slow breaths before your first meal each day.",
  habit_recap_focus_hydration: "Keep a full bottle on your desk and finish it by 3pm.",
  habit_recap_focus_log_more: "Log at least one meal every day next week.",
  habit_recap_focus_keep_going: "Keep going: repeat what worked this week.",
  habit_recap_prefill_nutrition: "Help me improve my eating habits next week",
  habit_recap_prefill_sleep: "Help me improve my sleep habits next week",
  habit_recap_prefill_stress: "Help me handle stress better next week",
  habit_recap_prefill_hydration: "Help me drink more water next week",
  habit_recap_prefill_general: "Help me build better habits next week",
} as const;

export type HabitRecapTextKey = keyof typeof HABIT_RECAP_TEXT;

export interface HabitRecapDayInput {
  dateStr: string;
  /** The day's saved checklist row; null when there was none. */
  checklist: { items: ChecklistItem[]; completed: ChecklistCompleted } | null;
  meals: ChecklistDayMeal[];
  waterMl: number;
  checkedIn: boolean;
}

export interface HabitRecapInput {
  /** The 7 days of the recap week, Monday first. */
  days: HabitRecapDayInput[];
  waterGoalMl: number;
  habit: { habit_title: string; completed_dates: string[] } | null;
  /** Check-ins covering the recap week and the week before. */
  checkIns: { check_in_date: string; energy_level: number; sleep_quality: number }[];
}

export type HabitDayState = "full" | "half" | "empty";

export interface HabitRecapDay {
  dateStr: string;
  done: number;
  total: number;
  ratio: number;
  state: HabitDayState;
}

export interface HabitRecap {
  days: HabitRecapDay[];
  hasChecklistData: boolean;
  totals: { itemsDone: number; itemsTotal: number; daysLogged: number; waterDays: number; habitDays: number };
  /** Completion rate (0–1) per category that had at least one item. */
  categoryRates: Partial<Record<ChecklistCategory, number>>;
  bestCategory: ChecklistCategory | null;
  weakestCategory: ChecklistCategory | null;
  habit: { title: string; doneCount: number } | null;
  energy: RecapMetric | null;
  sleep: RecapMetric | null;
  winKey: HabitRecapTextKey;
  focusKey: HabitRecapTextKey;
  prefillKey: HabitRecapTextKey;
  win: string;
  focus: string;
  coachPrefill: string;
}

/** Filled when more than half the items are ticked, half when some are, empty otherwise. */
export const dayStateFor = (done: number, total: number): HabitDayState =>
  total <= 0 || done <= 0 ? "empty" : done / total > 0.5 ? "full" : "half";

export function buildHabitRecap(input: HabitRecapInput): HabitRecap {
  const { days, waterGoalMl, habit, checkIns } = input;
  const dateStrs = days.map((d) => d.dateStr);
  const weekStartStr = dateStrs[0];
  const weekEndStr = dateStrs[dateStrs.length - 1];
  const inWeek = (s: string) => s >= weekStartStr && s <= weekEndStr;
  const habitDates = new Set((habit?.completed_dates ?? []).filter(inWeek));

  const catDone: Record<ChecklistCategory, number> = { nutrition: 0, sleep: 0, stress: 0, hydration: 0 };
  const catTotal: Record<ChecklistCategory, number> = { nutrition: 0, sleep: 0, stress: 0, hydration: 0 };

  const hasChecklistData = days.some((d) => (d.checklist?.items?.length ?? 0) > 0);

  const recapDays: HabitRecapDay[] = days.map((d) => {
    const items = d.checklist?.items ?? [];
    const completed = d.checklist?.completed ?? {};
    const dayState = {
      waterMl: d.waterMl,
      waterGoalMl,
      meals: d.meals,
      checkedInToday: d.checkedIn,
      habitDoneToday: habitDates.has(d.dateStr),
    };
    let done = 0;
    for (const item of items) {
      const cat = itemCategory(item);
      const ok = isItemDone(item, completed, dayState);
      catTotal[cat] += 1;
      if (ok) {
        catDone[cat] += 1;
        done += 1;
      }
    }
    const total = items.length;
    // Without any checklist data in the week, fall back to "a meal was logged" for the circles.
    const state = hasChecklistData ? dayStateFor(done, total) : d.meals.length > 0 ? "full" : "empty";
    return { dateStr: d.dateStr, done, total, ratio: total > 0 ? done / total : 0, state };
  });

  const totals = {
    itemsDone: recapDays.reduce((s, d) => s + d.done, 0),
    itemsTotal: recapDays.reduce((s, d) => s + d.total, 0),
    daysLogged: days.filter((d) => d.meals.length > 0).length,
    waterDays: waterGoalMl > 0 ? days.filter((d) => d.waterMl >= waterGoalMl).length : 0,
    habitDays: habitDates.size,
  };

  const categoryRates: Partial<Record<ChecklistCategory, number>> = {};
  for (const cat of HABIT_RECAP_CATEGORY_ORDER) {
    if (catTotal[cat] > 0) categoryRates[cat] = catDone[cat] / catTotal[cat];
  }
  const rated = HABIT_RECAP_CATEGORY_ORDER.filter((c) => categoryRates[c] !== undefined);
  // Ties go to the earlier category in nutrition → sleep → stress → hydration order.
  const bestCategory = rated.reduce<ChecklistCategory | null>(
    (best, c) => (best === null || categoryRates[c]! > categoryRates[best]! ? c : best),
    null,
  );
  const weakestCategory = rated.reduce<ChecklistCategory | null>(
    (worst, c) => (worst === null || categoryRates[c]! < categoryRates[worst]! ? c : worst),
    null,
  );

  const prevStartStr = format(addDays(new Date(`${weekStartStr}T12:00:00`), -7), "yyyy-MM-dd");
  const prevEndStr = format(addDays(new Date(`${weekStartStr}T12:00:00`), -1), "yyyy-MM-dd");
  const current = checkIns.filter((c) => inWeek(c.check_in_date));
  const previous = checkIns.filter((c) => c.check_in_date >= prevStartStr && c.check_in_date <= prevEndStr);
  const energy = metricFor(current.map((c) => c.energy_level), previous.map((c) => c.energy_level));
  const sleep = metricFor(current.map((c) => c.sleep_quality), previous.map((c) => c.sleep_quality));

  let winKey: HabitRecapTextKey;
  let focusKey: HabitRecapTextKey;
  let prefillKey: HabitRecapTextKey;
  if (bestCategory && weakestCategory && (categoryRates[bestCategory] ?? 0) > 0) {
    winKey = `habit_recap_win_${bestCategory}`;
    focusKey = `habit_recap_focus_${weakestCategory}`;
    prefillKey = `habit_recap_prefill_${weakestCategory}`;
  } else {
    if (habit && totals.habitDays >= 5) winKey = "habit_recap_win_habit";
    else if (totals.daysLogged >= 5) winKey = "habit_recap_win_logged_most";
    else if (totals.daysLogged >= 3) winKey = "habit_recap_win_logged_some";
    else winKey = "habit_recap_win_start";
    if (totals.daysLogged < 4) {
      focusKey = "habit_recap_focus_log_more";
      prefillKey = "habit_recap_prefill_general";
    } else if (sleep && sleep.avg < 3) {
      focusKey = "habit_recap_focus_sleep";
      prefillKey = "habit_recap_prefill_sleep";
    } else {
      focusKey = "habit_recap_focus_keep_going";
      prefillKey = "habit_recap_prefill_general";
    }
  }

  return {
    days: recapDays,
    hasChecklistData,
    totals,
    categoryRates,
    bestCategory,
    weakestCategory,
    habit: habit ? { title: habit.habit_title, doneCount: totals.habitDays } : null,
    energy,
    sleep,
    winKey,
    focusKey,
    prefillKey,
    win: HABIT_RECAP_TEXT[winKey],
    focus: HABIT_RECAP_TEXT[focusKey],
    coachPrefill: HABIT_RECAP_TEXT[prefillKey],
  };
}

export interface HabitRecapRawData {
  meals: { logged_at: string }[];
  water: { logged_at: string; amount_ml: number }[];
  checklists: { checklist_date: string; items: unknown; completed: unknown }[];
  checkInDates: string[];
}

const localDateKey = (value: string) => format(new Date(value), "yyyy-MM-dd");

/** Groups fetched rows into the 7 recap days by local calendar date (same day matching as habitProgress). */
export function groupHabitRecapDays(weekStart: Date, raw: HabitRecapRawData): HabitRecapDayInput[] {
  const dateStrs = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
  const checkedIn = new Set(raw.checkInDates);
  return dateStrs.map((dateStr) => {
    const row = raw.checklists.find((c) => c.checklist_date === dateStr);
    const items = row && Array.isArray(row.items) ? (row.items as ChecklistItem[]) : [];
    const completed =
      row && row.completed && typeof row.completed === "object" ? (row.completed as ChecklistCompleted) : {};
    return {
      dateStr,
      checklist: row ? { items, completed } : null,
      meals: raw.meals
        .filter((m) => localDateKey(m.logged_at) === dateStr)
        .map((m) => ({ name: "", loggedAtHour: new Date(m.logged_at).getHours(), proteinGrams: 0 })),
      waterMl: raw.water
        .filter((w) => localDateKey(w.logged_at) === dateStr)
        .reduce((s, w) => s + (w.amount_ml || 0), 0),
      checkedIn: checkedIn.has(dateStr),
    };
  });
}
