import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/mealService", () => ({ getFrequentMeals: vi.fn(), saveMeal: vi.fn() }));

import {
  computeBudget,
  computeScaleFactor,
  defaultMealsLeft,
  portionTag,
  rankScaledSuggestions,
} from "./LeftTodayCard";

const meal = (id: string, name: string, calories: number, protein: number, count = 1) =>
  ({
    id,
    user_id: "u",
    name,
    calories,
    protein,
    carbs: 50,
    fats: 20,
    sugar: 10,
    logged_at: "",
    created_at: "",
    count,
  }) as any;

describe("LeftTodayCard scaling rules", () => {
  it("defaults meals left by local hour", () => {
    expect(defaultMealsLeft(10)).toBe(3);
    expect(defaultMealsLeft(11)).toBe(2);
    expect(defaultMealsLeft(15)).toBe(2);
    expect(defaultMealsLeft(16)).toBe(1);
  });

  it("splits remaining (clamped at 0) across meals left", () => {
    expect(computeBudget({ calories: 1200, protein: 90, carbs: -10, fats: 60 }, 3)).toEqual({
      calories: 400,
      protein: 30,
      carbs: 0,
      fats: 20,
    });
  });

  it("clamps the multiplier to 0.5–2 and rounds to 0.25", () => {
    const budget = { calories: 600, protein: 40, carbs: 0, fats: 0 };
    expect(computeScaleFactor({ calories: 100, protein: 5 }, budget)).toBe(2);
    expect(computeScaleFactor({ calories: 3000, protein: 100 }, budget)).toBe(0.5);
    // kCal = 630/400 = 1.575, kProtein = 40/27 ≈ 1.48 → 1.48 → 1.5
    expect(computeScaleFactor({ calories: 400, protein: 27 }, budget)).toBe(1.5);
  });

  it("ignores protein when the protein budget is 5g or less", () => {
    const budget = { calories: 500, protein: 5, carbs: 0, fats: 0 };
    // kCal = 525/500 = 1.05 → 1
    expect(computeScaleFactor({ calories: 500, protein: 100 }, budget)).toBe(1);
  });

  it("excludes meals already logged today and scaled meals under 80 kcal", () => {
    const budget = { calories: 100, protein: 0, carbs: 0, fats: 0 };
    const result = rankScaledSuggestions(
      [meal("a", "Oats", 100, 10), meal("b", "Tiny snack", 30, 1), meal("c", "Eggs", 100, 12)],
      ["oats"],
      budget,
    );
    // Tiny snack: k=2 → 60 kcal → excluded; Oats logged today → excluded
    expect(result.map((r) => r.meal.id)).toEqual(["c"]);
  });

  it("scales all macros including sugar by k", () => {
    const budget = { calories: 800, protein: 60, carbs: 0, fats: 0 };
    const [s] = rankScaledSuggestions([meal("a", "Chicken rice", 400, 30)], [], budget);
    expect(s.k).toBe(2);
    expect(s.scaled).toEqual({ calories: 800, protein: 60, carbs: 100, fats: 40, sugar: 20 });
  });

  it("labels the portion tag", () => {
    expect(portionTag(1)).toBe("usual portion");
    expect(portionTag(1.5)).toBe("1.5× your last portion");
    expect(portionTag(0.75)).toBe("0.75× your last portion");
  });
});
