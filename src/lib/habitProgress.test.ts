import { describe, it, expect } from "vitest";
import { mealsPerDay, daysWithMealsLogged, daysWaterGoalMet, unchangedTargetsAdjustment } from "./habitProgress";

// Local-time dates so the tests hold in any timezone
const day = (d: number) => new Date(2026, 10, d); // November 2026
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).toISOString();
const week = [16, 17, 18, 19, 20, 21, 22].map(day); // Mon 16 – Sun 22

describe("mealsPerDay", () => {
  it("counts meals on each day, including days with none", () => {
    const meals = [{ logged_at: at(16, 8) }, { logged_at: at(16, 13) }, { logged_at: at(18, 19) }];
    expect(mealsPerDay(meals, week).map((d) => d.meals)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });

  it("labels days for the chart and ignores meals outside the range", () => {
    const result = mealsPerDay([{ logged_at: at(10, 12) }], [day(16)]);
    expect(result).toEqual([{ dateKey: "2026-11-16", label: "Mon", meals: 0 }]);
  });
});

describe("daysWithMealsLogged", () => {
  it("counts days with at least one meal, not meals", () => {
    const meals = [{ logged_at: at(16, 8) }, { logged_at: at(16, 12) }, { logged_at: at(17, 8) }, { logged_at: at(22, 20) }];
    expect(daysWithMealsLogged(meals, week)).toBe(3);
  });

  it("is 0 with no meals", () => {
    expect(daysWithMealsLogged([], week)).toBe(0);
  });
});

describe("daysWaterGoalMet", () => {
  it("counts days whose total water reaches the goal", () => {
    const water = [
      { logged_at: at(16, 9), amount_ml: 1500 },
      { logged_at: at(16, 15), amount_ml: 1000 }, // 2500 on Mon → met
      { logged_at: at(17, 9), amount_ml: 2499 }, // just under → not met
      { logged_at: at(18, 9), amount_ml: 2500 }, // exactly → met
    ];
    expect(daysWaterGoalMet(water, week, 2500)).toBe(2);
  });

  it("counts no days when there is no goal", () => {
    expect(daysWaterGoalMet([{ logged_at: at(16, 9), amount_ml: 3000 }], week, 0)).toBe(0);
  });
});

describe("unchangedTargetsAdjustment", () => {
  it("keeps every target exactly as it is, with zero calorie change", () => {
    const result = unchangedTargetsAdjustment({ calories: 2200, protein: 150, carbs: 240, fats: 70 });
    expect(result).toEqual({
      newCalories: 2200,
      newProtein: 150,
      newCarbs: 240,
      newFats: 70,
      deltaCalories: 0,
      baselineCalories: 2200,
      reason: "",
    });
  });
});
