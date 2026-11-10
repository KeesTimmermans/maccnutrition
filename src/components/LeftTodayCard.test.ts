import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/mealService", () => ({ getFrequentMeals: vi.fn(), saveMeal: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  computeBudget,
  computeScaleFactor,
  defaultMealsLeft,
  pickOptionA,
  pickOptionB,
  portionTag,
  rankScaledSuggestions,
} from "./LeftTodayCard";
import { flattenPlanMeals, PlanMeal } from "@/lib/mealPlanService";

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

const plan = (name: string, type: string, calories: number, protein: number): PlanMeal => ({
  name,
  type,
  calories,
  protein,
  carbs: 40,
  fats: 15,
});

describe("LeftTodayCard meal plan option", () => {
  const budget = { calories: 500, protein: 35, carbs: 0, fats: 0 };

  it("de-duplicates plan meals by lowercased trimmed name, keeping the first", () => {
    const result = flattenPlanMeals({
      days: [
        { meals: [{ name: "Chicken Salad", type: "lunch", calories: 450, protein: 40, carbs: 20, fats: 15 }] },
        {
          meals: [
            { name: "  chicken salad ", type: "dinner", calories: 600, protein: 50, carbs: 30, fats: 20 },
            { name: "Bad meal", type: "dinner", calories: "lots", protein: 10 },
            { type: "dinner", calories: 300, protein: 10 },
          ],
        },
      ],
    });
    expect(result).toEqual([
      { name: "Chicken Salad", type: "lunch", calories: 450, protein: 40, carbs: 20, fats: 15 },
    ]);
  });

  it("excludes a plan meal logged today and Option A's meal", () => {
    const meals = [
      plan("Porridge", "breakfast", 500, 35),
      plan("Greek yoghurt bowl", "breakfast", 500, 35),
      plan("Egg muffins", "breakfast", 500, 35),
    ];
    const b = pickOptionB(meals, ["porridge"], budget, 8, "Greek Yoghurt Bowl");
    expect(b?.meal.name).toBe("Egg muffins");
  });

  it("prefers breakfast over dinner before 11:00", () => {
    const meals = [plan("Steak and rice", "Dinner", 500, 35), plan("Protein oats", "Breakfast", 500, 30)];
    expect(pickOptionB(meals, [], budget, 9)?.meal.name).toBe("Protein oats");
  });

  it("falls back to all plan meal types when no preferred type fits", () => {
    const meals = [plan("Steak and rice", "Dinner", 500, 35), plan("Tiny oats", "Breakfast", 20, 1)];
    expect(pickOptionB(meals, [], budget, 9)?.meal.name).toBe("Steak and rice");
  });

  it("returns no plan option when the plan is empty", () => {
    expect(pickOptionB([], [], budget, 12)).toBeNull();
    expect(flattenPlanMeals(null)).toEqual([]);
  });

  it("Option A is the single best logged meal", () => {
    const a = pickOptionA([meal("x", "Wrap", 500, 35, 3), meal("y", "Toast", 500, 5, 3)], [], budget);
    expect(a?.meal.name).toBe("Wrap");
  });
});
