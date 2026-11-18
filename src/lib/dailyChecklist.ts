/**
 * Today's checklist — pure helpers (no React, no network), shared by TodayChecklistCard and its tests.
 * Item shape matches supabase/functions/_shared/checklistRules.ts, which also owns the category/exercise rules.
 */
import {
  classifyCategory,
  isChecklistCategory,
  isExerciseItem,
  type ChecklistCategory,
} from "../../supabase/functions/_shared/checklistRules.ts";

export type { ChecklistCategory };
export { classifyCategory };

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
  category: ChecklistCategory;
  rule?: ChecklistRule;
}

/** An item's category, classified by keywords if a saved item somehow lacks one. */
export const itemCategory = (item: Pick<ChecklistItem, "title" | "why"> & { category?: unknown }): ChecklistCategory =>
  isChecklistCategory(item.category) ? item.category : classifyCategory(`${item.title} ${item.why ?? ""}`);

/** item id -> ISO timestamp, for manual ticks only. */
export type ChecklistCompleted = Record<string, string>;

export interface DailyChecklistRow {
  id: string;
  user_id: string;
  checklist_date: string;
  items: ChecklistItem[];
  completed: ChecklistCompleted;
}

export interface ChecklistDayMeal {
  name: string;
  /** Local hour (0–23) the meal was logged at. */
  loggedAtHour: number;
  proteinGrams: number;
}

export interface ChecklistDayState {
  waterMl: number;
  waterGoalMl: number;
  meals: ChecklistDayMeal[];
  checkedInToday: boolean;
  /** Whether today is ticked on this week's habit (weekly_habits.completed_dates). */
  habitDoneToday?: boolean;
}

/** Breakfast before 11, lunch 11 until 16, dinner from 16. */
export const mealSlotForHour = (hour: number): "breakfast" | "lunch" | "dinner" =>
  hour < 11 ? "breakfast" : hour < 16 ? "lunch" : "dinner";

export const isAutoItemDone = (item: ChecklistItem, day: ChecklistDayState): boolean => {
  const rule = item.rule;
  if (!rule) return false;
  switch (rule.type) {
    case "water_goal":
      return day.waterGoalMl > 0 && day.waterMl >= day.waterGoalMl;
    case "meal_logged":
      return rule.meal === "any"
        ? day.meals.length > 0
        : day.meals.some((m) => mealSlotForHour(m.loggedAtHour) === rule.meal);
    case "checkin_done":
      return day.checkedInToday;
    case "protein_by_hour": {
      const total = day.meals.filter((m) => m.loggedAtHour < rule.hour).reduce((s, m) => s + (m.proteinGrams || 0), 0);
      return total >= rule.grams;
    }
    default:
      return false;
  }
};

export const isItemDone = (item: ChecklistItem, completed: ChecklistCompleted, day: ChecklistDayState): boolean => {
  if (item.kind === "auto") return isAutoItemDone(item, day);
  if (item.kind === "habit") return !!day.habitDoneToday;
  return !!completed[item.id];
};

export const computeProgress = (
  items: ChecklistItem[],
  completed: ChecklistCompleted,
  day: ChecklistDayState,
): { done: number; total: number } => ({
  done: items.filter((i) => isItemDone(i, completed, day)).length,
  total: items.length,
});

const WHEN_ORDER: ChecklistWhen[] = ["morning", "breakfast", "lunch", "afternoon", "dinner", "evening", "anytime"];

/** Morning → evening, 'anytime' last; stable within a slot. */
export const sortByWhen = (items: ChecklistItem[]): ChecklistItem[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => WHEN_ORDER.indexOf(a.item.when) - WHEN_ORDER.indexOf(b.item.when) || a.index - b.index)
    .map(({ item }) => item);

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Adds up to 3 of today's check-in focus points as manual items (source 'checkin', ids ci-1…ci-3),
 * skipping any whose text is already on the list and any about workouts or exercise.
 * Returns the same array when nothing changes.
 */
export const mergeCheckinFocusPoints = (
  items: ChecklistItem[],
  focusPoints: { text: string; tip?: string }[] | null | undefined,
): ChecklistItem[] => {
  if (!focusPoints || focusPoints.length === 0) return items;
  const titles = new Set(items.map((i) => normalize(i.title)));
  const ids = new Set(items.map((i) => i.id));
  const added: ChecklistItem[] = [];
  focusPoints.slice(0, 3).forEach((point, index) => {
    const text = (point.text || "").trim();
    const id = `ci-${index + 1}`;
    const tip = (point.tip || "").trim();
    if (!text || ids.has(id) || titles.has(normalize(text)) || isExerciseItem(text, tip)) return;
    titles.add(normalize(text));
    added.push({
      id,
      title: text,
      ...(tip ? { why: tip } : {}),
      when: "anytime",
      kind: "manual",
      source: "checkin",
      category: classifyCategory(`${text} ${tip}`),
    });
  });
  return added.length > 0 ? [...items, ...added] : items;
};

/** The device's local calendar date as YYYY-MM-DD (not UTC). */
export const localDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
