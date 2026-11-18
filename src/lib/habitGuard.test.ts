import { describe, it, expect } from "vitest";
import {
  containsNutritionNumbers,
  stripNutritionSentences,
  guardHabitReply,
  HABIT_FALLBACK_LINE,
  isHabitTrackingMode,
} from "../../supabase/functions/_shared/habitGuard";

const MEAL_JSON = '```json\n{"type":"meal_suggestion","meal":{"title":"Chicken wrap","estimated_macros":{"calories":450,"protein_g":35},"log_payload":[{"ingredient":"chicken breast","quantity":150,"unit":"g"}]}}\n```';

describe("containsNutritionNumbers", () => {
  it.each([
    "That's about 450 kcal.",
    "You've had 1200 calories so far.",
    "Aim for 30g protein at breakfast.",
    "Add 25-30 g of protein to lunch.",
    "Protein: 40g at dinner.",
    "Your macros look good today.",
    "You're close to your target.",
    "You're at 80% of your protein.",
    "A small deficit works best.",
    "Eat in a slight surplus.",
  ])("flags %s", (text) => {
    expect(containsNutritionNumbers(text)).toBe(true);
  });

  it.each([
    "Have a palm of protein with breakfast, like two eggs.",
    "Fill half your plate with vegetables at dinner.",
    "Stop eating when you're about 80% full.",
    "Drink a glass of water before lunch — aim for 2.5 litres today.",
    "Plan tomorrow's lunch tonight and eat slowly.",
  ])("lets normal habit text pass: %s", (text) => {
    expect(containsNutritionNumbers(text)).toBe(false);
  });

  it("ignores numbers inside ```json meal blocks", () => {
    expect(containsNutritionNumbers(`A palm of chicken in a wrap with salad.\n\n${MEAL_JSON}`)).toBe(false);
  });
});

describe("stripNutritionSentences", () => {
  it("removes only the offending sentences", () => {
    const out = stripNutritionSentences("Great start today. That bowl was about 450 kcal. Have a palm of protein at lunch.");
    expect(out).toBe("Great start today. Have a palm of protein at lunch.");
  });

  it("leaves ```json blocks byte-for-byte", () => {
    const text = `That's 35g protein. A palm of chicken in a wrap.\n\n${MEAL_JSON}`;
    const out = stripNutritionSentences(text);
    expect(out).toContain(MEAL_JSON);
    expect(out.startsWith("A palm of chicken in a wrap.")).toBe(true);
  });

  it("drops a focus point and its how-to tip together", () => {
    const text = "---DAILY_FOCUS---\n🥩 Hit 120g protein today\n→ Eggs at breakfast\n💧 Water before meals\n→ Keep a bottle nearby\n---END_DAILY_FOCUS---";
    expect(stripNutritionSentences(text)).toBe(
      "---DAILY_FOCUS---\n💧 Water before meals\n→ Keep a bottle nearby\n---END_DAILY_FOCUS---",
    );
  });
});

describe("guardHabitReply", () => {
  it("never returns an empty reply", () => {
    expect(guardHabitReply("You've had 1200 calories.")).toBe(HABIT_FALLBACK_LINE);
  });

  it("keeps the meal card when all prose is removed", () => {
    const out = guardHabitReply(`This is 450 kcal.\n\n${MEAL_JSON}`);
    expect(out).toBe(`${HABIT_FALLBACK_LINE}\n\n${MEAL_JSON}`);
  });
});

describe("isHabitTrackingMode", () => {
  it("treats only 'habits' as habit mode", () => {
    expect(isHabitTrackingMode("habits")).toBe(true);
    expect(isHabitTrackingMode("calories")).toBe(false);
    expect(isHabitTrackingMode(null)).toBe(false);
    expect(isHabitTrackingMode("weird")).toBe(false);
  });
});
