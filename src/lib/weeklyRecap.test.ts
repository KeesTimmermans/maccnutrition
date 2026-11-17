import { describe, it, expect } from "vitest";
import { buildRecap, getRecapWeek, type RecapInput } from "./weeklyRecap";

// Monday 9 Nov 2026 – Sunday 15 Nov 2026
const weekStart = new Date(2026, 10, 9);
const targets = { calories: 2000, protein: 100 };
const day = (i: number) => `2026-11-${String(9 + i).padStart(2, "0")}`;
const meal = (i: number, calories: number, protein: number) => ({
  logged_at: `${day(i)}T12:00:00.000Z`,
  calories,
  protein,
});

const base = (overrides: Partial<RecapInput> = {}): RecapInput => ({
  meals: [],
  targets,
  weekStart,
  habit: null,
  checkIns: [],
  isFinal: true,
  ...overrides,
});

describe("getRecapWeek", () => {
  it("Sunday returns this week so far, not final", () => {
    const r = getRecapWeek(new Date(2026, 10, 15, 10));
    expect(r).not.toBeNull();
    expect(r!.isFinal).toBe(false);
    expect(r!.start).toEqual(new Date(2026, 10, 9, 0, 0, 0, 0));
    expect(r!.end).toEqual(new Date(2026, 10, 15, 23, 59, 59, 999));
  });

  it("Monday returns last week, final", () => {
    const r = getRecapWeek(new Date(2026, 10, 16, 8));
    expect(r!.isFinal).toBe(true);
    expect(r!.start).toEqual(new Date(2026, 10, 9, 0, 0, 0, 0));
    expect(r!.end).toEqual(new Date(2026, 10, 15, 23, 59, 59, 999));
  });

  it("Wednesday returns null", () => {
    expect(getRecapWeek(new Date(2026, 10, 11, 12))).toBeNull();
  });
});

describe("buildRecap thresholds", () => {
  it("protein met at 90% of target, not below", () => {
    const r = buildRecap(base({ meals: [meal(0, 2000, 90), meal(1, 2000, 89)] }));
    expect(r.days[0].proteinMet).toBe(true);
    expect(r.days[1].proteinMet).toBe(false);
  });

  it("calories met only within 90%-110% of target", () => {
    const r = buildRecap(
      base({ meals: [meal(0, 1800, 0), meal(1, 2200, 0), meal(2, 1799, 0), meal(3, 2201, 0)] })
    );
    expect(r.days.map((d) => d.caloriesMet).slice(0, 4)).toEqual([true, true, false, false]);
    expect(r.days[4].caloriesMet).toBe(false); // not logged
  });

  it("averages are over logged days only", () => {
    const r = buildRecap(base({ meals: [meal(0, 1000, 50), meal(0, 1000, 50), meal(2, 3000, 150)] }));
    expect(r.daysLogged).toBe(2);
    expect(r.avgProtein).toBe(125);
    expect(r.avgCalories).toBe(2500);
  });
});

describe("buildRecap habit", () => {
  it("counts only completed dates inside the recap week", () => {
    const r = buildRecap(
      base({ habit: { habit_title: "Walk", completed_dates: ["2026-11-08", day(0), day(3), day(6), "2026-11-16"] } })
    );
    expect(r.habit).toEqual({ title: "Walk", doneCount: 3 });
  });
});

describe("buildRecap win priority", () => {
  const sixDaysProtein = [0, 1, 2, 3, 4, 5].map((i) => meal(i, 2000, 100));

  it("habit 6/7 wins first", () => {
    const r = buildRecap(
      base({ meals: sixDaysProtein, habit: { habit_title: "H", completed_dates: [0, 1, 2, 3, 4, 5].map(day) } })
    );
    expect(r.win).toBe("You nailed your habit: 6/7 days.");
  });

  it("then protein days >= 5", () => {
    expect(buildRecap(base({ meals: sixDaysProtein })).win).toBe("You hit your protein on 6 days.");
  });

  it("then days logged >= 5", () => {
    const meals = [0, 1, 2, 3, 4].map((i) => meal(i, 2000, 10));
    expect(buildRecap(base({ meals })).win).toBe("You logged 5 days this week.");
  });

  it("then days logged >= 3", () => {
    const meals = [0, 1, 2].map((i) => meal(i, 2000, 10));
    expect(buildRecap(base({ meals })).win).toBe("Showing up counts: 3 days logged.");
  });

  it("falls back when fewer than 3 days", () => {
    expect(buildRecap(base({ meals: [meal(0, 2000, 10)] })).win).toBe("You're tracking, and that's the first step.");
  });
});

describe("buildRecap focus priority", () => {
  it("fewer than 4 days logged → log more", () => {
    const meals = [0, 1, 2].map((i) => meal(i, 2000, 100));
    expect(buildRecap(base({ meals })).focus).toBe(
      "Aim to log at least 5 days next week. Logging is what makes everything else work."
    );
  });

  it("protein days < 4 → protein focus", () => {
    const meals = [0, 1, 2, 3, 4].map((i) => meal(i, 2000, 10));
    expect(buildRecap(base({ meals })).focus).toBe(
      "Aim to hit your protein on 5 days. Add a protein source to breakfast to get a head start."
    );
  });

  it("calorie days < 3 → calorie focus", () => {
    const meals = [0, 1, 2, 3, 4].map((i) => meal(i, 3000, 100));
    expect(buildRecap(base({ meals })).focus).toBe(
      "Aim to land closer to your calorie target. The Left today card on the Today page shows what fits."
    );
  });

  it("poor sleep → sleep focus", () => {
    const meals = [0, 1, 2, 3, 4].map((i) => meal(i, 2000, 100));
    const checkIns = [0, 1, 2].map((i) => ({ check_in_date: day(i), energy_level: 3, sleep_quality: 2 }));
    expect(buildRecap(base({ meals, checkIns })).focus).toBe("Protect your sleep this week. It drives hunger and energy.");
  });

  it("falls back to keep going", () => {
    const meals = [0, 1, 2, 3, 4].map((i) => meal(i, 2000, 100));
    expect(buildRecap(base({ meals })).focus).toBe("Keep going. Repeat what worked this week.");
  });
});

describe("buildRecap check-ins", () => {
  const prev = (i: number, energy: number, sleep: number) => ({
    check_in_date: `2026-11-0${2 + i}`,
    energy_level: energy,
    sleep_quality: sleep,
  });
  const cur = (i: number, energy: number, sleep: number) => ({ check_in_date: day(i), energy_level: energy, sleep_quality: sleep });

  it("null when the recap week has fewer than 3 check-ins", () => {
    const r = buildRecap(base({ checkIns: [cur(0, 4, 4), cur(1, 4, 4), prev(0, 2, 2), prev(1, 2, 2), prev(2, 2, 2)] }));
    expect(r.energy).toBeNull();
    expect(r.sleep).toBeNull();
  });

  it("up, down and same against the previous week", () => {
    const r = buildRecap(
      base({
        checkIns: [
          cur(0, 4, 3), cur(1, 4, 3), cur(2, 4, 3.2),
          prev(0, 3, 4), prev(1, 3, 4), prev(2, 3, 3),
        ],
      })
    );
    expect(r.energy).toEqual({ avg: 4, direction: "up" });
    // current sleep 3.07 vs previous 3.67 → down
    expect(r.sleep?.direction).toBe("down");

    const same = buildRecap(
      base({ checkIns: [cur(0, 3, 3), cur(1, 3, 3), cur(2, 3, 3), prev(0, 3.1, 3), prev(1, 3.1, 3), prev(2, 3.1, 3)] })
    );
    expect(same.energy?.direction).toBe("same");
  });

  it("no direction when the previous week has fewer than 3 check-ins", () => {
    const r = buildRecap(base({ checkIns: [cur(0, 4, 4), cur(1, 4, 4), cur(2, 4, 4), prev(0, 1, 1)] }));
    expect(r.energy).toEqual({ avg: 4, direction: null });
  });
});

describe("buildRecap coach prefill", () => {
  it("includes habit when present", () => {
    const r = buildRecap(
      base({ meals: [meal(0, 2000, 100)], habit: { habit_title: "H", completed_dates: [day(0)] } })
    );
    expect(r.coachPrefill).toBe(
      "Here's my week: logged 1 days, protein target hit on 1 days, habit 1/7. What's one thing I should focus on next week?"
    );
  });
});
