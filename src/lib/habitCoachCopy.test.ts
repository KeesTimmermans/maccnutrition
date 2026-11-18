import { describe, it, expect } from "vitest";
import {
  generateHabitCoachGreeting,
  generateHabitCoachInsights,
  generateHabitCoachTip,
  mentionsNutritionNumbers,
  coachParagraphs,
  type HabitCoachInput,
} from "@/lib/habitCoachCopy";

const banned = [/\d+\s?(kcal|cal|g)\b/i, /calor/i, /macro/i, /%.*(calor|protein)/i];

const inputs: HabitCoachInput[] = [];
for (let hour = 0; hour < 24; hour++) {
  for (const mealsLogged of [0, 1, 2, 3, 5]) {
    for (const [waterMl, waterGoalMl] of [[0, 2500], [1200, 2500], [2400, 2500], [3000, 2500], [0, 0]]) {
      for (const checkedInToday of [true, false]) {
        for (const firstName of ["", "Sam"]) {
          inputs.push({ hour, mealsLogged, waterMl, waterGoalMl, checkedInToday, firstName });
        }
      }
    }
  }
}

const expectClean = (text: string) => {
  for (const pattern of banned) expect(text).not.toMatch(pattern);
};

describe("habit coach copy", () => {
  it("greeting never mentions calories, macros or nutrition percentages", () => {
    for (const input of inputs) expectClean(generateHabitCoachGreeting(input));
  });

  it("insights never mention calories, macros or nutrition percentages", () => {
    for (const input of inputs) {
      const insights = generateHabitCoachInsights(input);
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.length).toBeLessThanOrEqual(3);
      insights.forEach(expectClean);
    }
  });

  it("tip never mentions calories, macros or nutrition percentages", () => {
    for (const input of inputs) expectClean(generateHabitCoachTip(input));
  });

  it("no habit copy trips the nutrition-number detector either", () => {
    for (const input of inputs) {
      const all = [generateHabitCoachGreeting(input), generateHabitCoachTip(input), ...generateHabitCoachInsights(input)];
      all.forEach((text) => expect(mentionsNutritionNumbers(text)).toBe(false));
    }
  });

  it("says when no meals are logged yet, without guilt", () => {
    const text = generateHabitCoachGreeting({ hour: 15, mealsLogged: 0, waterMl: 0, waterGoalMl: 2500, checkedInToday: false });
    expect(text).toMatch(/no meals logged yet/i);
  });

  it("counts meals logged", () => {
    const text = generateHabitCoachGreeting({ hour: 13, mealsLogged: 2, waterMl: 0, waterGoalMl: 2500, checkedInToday: true });
    expect(text).toContain("2 meals");
  });
});

describe("mentionsNutritionNumbers", () => {
  it("flags calorie, macro, gram, target and percentage copy", () => {
    expect(mentionsNutritionNumbers("Today: 2000 kcal")).toBe(true);
    expect(mentionsNutritionNumbers("Need 40g protein")).toBe(true);
    expect(mentionsNutritionNumbers("Active jobs burn extra calories")).toBe(true);
    expect(mentionsNutritionNumbers("Hit your target")).toBe(true);
    expect(mentionsNutritionNumbers("Only 20% of goal")).toBe(true);
    expect(mentionsNutritionNumbers("Protein: 30/120")).toBe(true);
    expect(mentionsNutritionNumbers("Balance your macros")).toBe(true);
  });

  it("lets habit and behaviour copy through", () => {
    expect(mentionsNutritionNumbers("Put fork down between bites. Chew 20x.")).toBe(false);
    expect(mentionsNutritionNumbers("Walk 10min after lunch. Add omega-3 (salmon/walnuts).")).toBe(false);
    expect(mentionsNutritionNumbers("Drink 2 glasses of water")).toBe(false);
    expect(mentionsNutritionNumbers("Prep protein snacks NOW (nuts, cheese, boiled eggs).")).toBe(false);
    expect(mentionsNutritionNumbers(null)).toBe(false);
  });
});

describe("coachParagraphs", () => {
  const reply = "Great work this fortnight.\n\nI've nudged your target to 2100 kcal.\nKeep your evening walks going.";

  it("keeps every non-blank paragraph when numbers may show", () => {
    expect(coachParagraphs(reply, false)).toEqual([
      "Great work this fortnight.",
      "I've nudged your target to 2100 kcal.",
      "Keep your evening walks going.",
    ]);
  });

  it("drops paragraphs that mention calories or targets when numbers are hidden", () => {
    expect(coachParagraphs(reply, true)).toEqual(["Great work this fortnight.", "Keep your evening walks going."]);
  });
});
