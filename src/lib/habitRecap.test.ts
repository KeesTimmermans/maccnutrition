import { describe, expect, it } from "vitest";
import { buildHabitRecap, dayStateFor, groupHabitRecapDays, type HabitRecapDayInput } from "@/lib/habitRecap";
import type { ChecklistItem } from "@/lib/dailyChecklist";
import { containsNutritionNumbers } from "../../supabase/functions/_shared/habitGuard.ts";

const WEEK = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];

const items: ChecklistItem[] = [
  { id: "water", title: "Reach your water goal today", when: "anytime", kind: "auto", source: "water", category: "hydration", rule: { type: "water_goal" } },
  { id: "lunch", title: "Log your lunch in the app", when: "lunch", kind: "auto", source: "fallback", category: "nutrition", rule: { type: "meal_logged", meal: "lunch" } },
  { id: "screens", title: "Screens off 30 minutes before bed", when: "evening", kind: "manual", source: "fallback", category: "sleep" },
  { id: "habit", title: "Weekly habit", when: "anytime", kind: "habit", source: "weekly_habit", category: "stress" },
];

const day = (dateStr: string, over: Partial<HabitRecapDayInput> = {}): HabitRecapDayInput => ({
  dateStr,
  checklist: { items, completed: {} },
  meals: [],
  waterMl: 0,
  checkedIn: false,
  ...over,
});

describe("dayStateFor", () => {
  it("is full above half, half for some, empty for none", () => {
    expect(dayStateFor(3, 4)).toBe("full");
    expect(dayStateFor(2, 4)).toBe("half");
    expect(dayStateFor(1, 4)).toBe("half");
    expect(dayStateFor(0, 4)).toBe("empty");
    expect(dayStateFor(0, 0)).toBe("empty");
  });
});

describe("buildHabitRecap", () => {
  it("evaluates auto items from each day's data and counts manual and habit ticks", () => {
    const days = WEEK.map((d) => day(d));
    // Mon: water met, lunch logged at 12, screens ticked, habit done → 4/4
    days[0] = day(WEEK[0], {
      waterMl: 2500,
      meals: [{ name: "", loggedAtHour: 12, proteinGrams: 0 }],
      checklist: { items, completed: { screens: "2026-11-09T21:00:00Z" } },
    });
    // Tue: breakfast only (no lunch) and water short → 0/4
    days[1] = day(WEEK[1], { waterMl: 1000, meals: [{ name: "", loggedAtHour: 8, proteinGrams: 0 }] });
    // Wed: only screens ticked → 1/4
    days[2] = day(WEEK[2], { checklist: { items, completed: { screens: "x" } } });
    // Thu: no checklist row
    days[3] = day(WEEK[3], { checklist: null });

    const recap = buildHabitRecap({
      days,
      waterGoalMl: 2000,
      habit: { habit_title: "Five slow breaths", completed_dates: [WEEK[0], "2026-11-02"] },
      checkIns: [],
    });

    expect(recap.days.map((d) => `${d.done}/${d.total}`)).toEqual(["4/4", "0/4", "1/4", "0/0", "0/4", "0/4", "0/4"]);
    expect(recap.days.map((d) => d.state)).toEqual(["full", "empty", "half", "empty", "empty", "empty", "empty"]);
    expect(recap.totals).toEqual({ itemsDone: 5, itemsTotal: 24, daysLogged: 2, waterDays: 1, habitDays: 1 });
    expect(recap.categoryRates.sleep).toBeCloseTo(2 / 6);
    expect(recap.bestCategory).toBe("sleep");
    expect(recap.weakestCategory).toBe("nutrition");
    expect(recap.win).toBe("Your sleep routine was your strongest habit this week.");
    expect(recap.focus).toBe("Add a palm of protein to breakfast every day.");
    expect(recap.coachPrefill).toBe("Help me improve my eating habits next week");
  });

  it("breaks ties in the order nutrition, sleep, stress, hydration and ignores empty categories", () => {
    const only: ChecklistItem[] = [
      { id: "a", title: "Have a piece of fruit with lunch", when: "lunch", kind: "manual", source: "ai", category: "hydration" },
      { id: "b", title: "Take five slow breaths before lunch", when: "lunch", kind: "manual", source: "ai", category: "stress" },
    ];
    const recap = buildHabitRecap({
      days: WEEK.map((d) => day(d, { checklist: { items: only, completed: { a: "x", b: "x" } } })),
      waterGoalMl: 2000,
      habit: null,
      checkIns: [],
    });
    expect(Object.keys(recap.categoryRates).sort()).toEqual(["hydration", "stress"]);
    expect(recap.bestCategory).toBe("stress");
    expect(recap.weakestCategory).toBe("stress");
  });

  it("falls back to days logged, habit and check-ins when there is no checklist data", () => {
    const recap = buildHabitRecap({
      days: WEEK.map((d, i) => day(d, { checklist: null, meals: i < 5 ? [{ name: "", loggedAtHour: 9, proteinGrams: 0 }] : [] })),
      waterGoalMl: 2000,
      habit: { habit_title: "x", completed_dates: WEEK.slice(0, 2) },
      checkIns: [
        { check_in_date: WEEK[0], energy_level: 2, sleep_quality: 2 },
        { check_in_date: WEEK[1], energy_level: 3, sleep_quality: 2 },
        { check_in_date: WEEK[2], energy_level: 4, sleep_quality: 3 },
      ],
    });
    expect(recap.hasChecklistData).toBe(false);
    expect(recap.days.map((d) => d.state)).toEqual(["full", "full", "full", "full", "full", "empty", "empty"]);
    expect(recap.winKey).toBe("habit_recap_win_logged_most");
    expect(recap.focusKey).toBe("habit_recap_focus_sleep");
    expect(recap.energy).toEqual({ avg: 3, direction: null });
    expect(recap.sleep?.avg).toBe(2.3);
  });

  it("asks to log more when fewer than 4 days were logged", () => {
    const recap = buildHabitRecap({ days: WEEK.map((d) => day(d, { checklist: null })), waterGoalMl: 2000, habit: null, checkIns: [] });
    expect(recap.winKey).toBe("habit_recap_win_start");
    expect(recap.focusKey).toBe("habit_recap_focus_log_more");
    expect(recap.prefillKey).toBe("habit_recap_prefill_general");
  });

  it("never puts nutrition numbers in its sentences", () => {
    const recap = buildHabitRecap({ days: WEEK.map((d) => day(d)), waterGoalMl: 2000, habit: null, checkIns: [] });
    for (const text of [recap.win, recap.focus, recap.coachPrefill]) {
      expect(containsNutritionNumbers(text), text).toBe(false);
      expect(/\d/.test(recap.coachPrefill)).toBe(false);
    }
  });
});

describe("groupHabitRecapDays", () => {
  it("buckets meals, water, checklists and check-ins by local date", () => {
    const start = new Date(2026, 10, 9);
    const days = groupHabitRecapDays(start, {
      meals: [{ logged_at: new Date(2026, 10, 9, 12, 30).toISOString() }, { logged_at: new Date(2026, 10, 10, 8).toISOString() }],
      water: [
        { logged_at: new Date(2026, 10, 9, 9).toISOString(), amount_ml: 500 },
        { logged_at: new Date(2026, 10, 9, 15).toISOString(), amount_ml: 750 },
      ],
      checklists: [{ checklist_date: "2026-11-11", items, completed: { screens: "x" } }],
      checkInDates: ["2026-11-12"],
    });
    expect(days.map((d) => d.dateStr)).toEqual(WEEK);
    expect(days[0].meals).toHaveLength(1);
    expect(days[0].meals[0].loggedAtHour).toBe(12);
    expect(days[0].waterMl).toBe(1250);
    expect(days[2].checklist?.completed).toEqual({ screens: "x" });
    expect(days[0].checklist).toBeNull();
    expect(days[3].checkedIn).toBe(true);
  });
});
