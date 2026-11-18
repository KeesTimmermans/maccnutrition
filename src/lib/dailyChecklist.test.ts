import { describe, it, expect } from "vitest";
import {
  isAutoItemDone,
  computeProgress,
  mergeCheckinFocusPoints,
  sortByWhen,
  localDateString,
  type ChecklistItem,
  type ChecklistDayState,
} from "./dailyChecklist";

const day = (over: Partial<ChecklistDayState> = {}): ChecklistDayState => ({
  waterMl: 0,
  waterGoalMl: 2500,
  meals: [],
  checkedInToday: false,
  ...over,
});
const auto = (rule: ChecklistItem["rule"]): ChecklistItem => ({ id: "a", title: "x x x x", when: "anytime", kind: "auto", source: "ai", rule });

describe("isAutoItemDone", () => {
  it("water goal ticks when reached", () => {
    expect(isAutoItemDone(auto({ type: "water_goal" }), day({ waterMl: 2400 }))).toBe(false);
    expect(isAutoItemDone(auto({ type: "water_goal" }), day({ waterMl: 2500 }))).toBe(true);
  });

  it("classifies meals by logged hour: breakfast before 11, lunch 11–16, dinner after", () => {
    const meals = (h: number) => day({ meals: [{ name: "m", loggedAtHour: h, proteinGrams: 0 }] });
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "breakfast" }), meals(10))).toBe(true);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "breakfast" }), meals(11))).toBe(false);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "lunch" }), meals(11))).toBe(true);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "lunch" }), meals(15))).toBe(true);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "dinner" }), meals(16))).toBe(true);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "dinner" }), meals(15))).toBe(false);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "any" }), day())).toBe(false);
    expect(isAutoItemDone(auto({ type: "meal_logged", meal: "any" }), meals(20))).toBe(true);
  });

  it("check-in and protein-by-hour rules", () => {
    expect(isAutoItemDone(auto({ type: "checkin_done" }), day({ checkedInToday: true }))).toBe(true);
    const rule = auto({ type: "protein_by_hour", grams: 30, hour: 10 });
    expect(isAutoItemDone(rule, day({ meals: [{ name: "eggs", loggedAtHour: 8, proteinGrams: 32 }] }))).toBe(true);
    expect(isAutoItemDone(rule, day({ meals: [{ name: "eggs", loggedAtHour: 10, proteinGrams: 32 }] }))).toBe(false);
  });
});

describe("computeProgress", () => {
  it("counts manual ticks, auto rules and the weekly habit", () => {
    const items: ChecklistItem[] = [
      { id: "water", title: "Reach your water goal today", when: "anytime", kind: "auto", source: "water", rule: { type: "water_goal" } },
      { id: "weekly-habit", title: "A palm of protein at breakfast", when: "anytime", kind: "habit", source: "weekly_habit" },
      { id: "ai-1", title: "Take a 10-minute walk after dinner", when: "evening", kind: "manual", source: "ai" },
      { id: "ai-2", title: "Prep tomorrow's lunch tonight", when: "evening", kind: "manual", source: "ai" },
    ];
    expect(computeProgress(items, { "ai-1": "2026-11-18T19:00:00Z" }, day({ waterMl: 3000, habitDoneToday: true }))).toEqual({ done: 3, total: 4 });
    expect(computeProgress(items, {}, day())).toEqual({ done: 0, total: 4 });
  });
});

describe("mergeCheckinFocusPoints", () => {
  const base: ChecklistItem[] = [{ id: "ai-1", title: "Take a 10-minute walk after dinner", when: "evening", kind: "manual", source: "ai" }];

  it("adds up to 3 points with stable ids and the check-in source", () => {
    const merged = mergeCheckinFocusPoints(base, [
      { text: "A palm of protein at lunch", tip: "Chicken or lentils" },
      { text: "Water before each meal" },
      { text: "Wind down 30 minutes earlier" },
      { text: "Fourth point" },
    ]);
    expect(merged.map((i) => i.id)).toEqual(["ai-1", "ci-1", "ci-2", "ci-3"]);
    expect(merged[1]).toMatchObject({ source: "checkin", kind: "manual", why: "Chicken or lentils" });
  });

  it("de-duplicates by text and returns the same array when nothing changes", () => {
    expect(mergeCheckinFocusPoints(base, [{ text: "take a 10-minute  walk after dinner" }])).toBe(base);
    const once = mergeCheckinFocusPoints(base, [{ text: "Water before each meal" }]);
    expect(mergeCheckinFocusPoints(once, [{ text: "Water before each meal" }])).toBe(once);
  });
});

describe("ordering and dates", () => {
  it("sorts morning to evening with anytime last", () => {
    const mk = (id: string, when: ChecklistItem["when"]): ChecklistItem => ({ id, title: id, when, kind: "manual", source: "ai" });
    expect(sortByWhen([mk("a", "anytime"), mk("b", "evening"), mk("c", "breakfast"), mk("d", "lunch")]).map((i) => i.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("builds the local date, not UTC", () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
});
