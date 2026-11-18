import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  HABIT_CORE_REPLACEMENTS,
  HABIT_PROGRESS_REPLACEMENTS,
  habitCycleDirective,
  dropCompPrepNutritionLines,
} from "../../supabase/functions/ai-coach/habitPrompt";
import { containsNutritionNumbers } from "../../supabase/functions/_shared/habitGuard";

// The ai-coach source holds the calorie-mode prompt; read it as text (it imports Deno modules).
const source = readFileSync(resolve(__dirname, "../../supabase/functions/ai-coach/index.ts"), "utf8");

describe("habit prompt replacements", () => {
  it.each([...HABIT_CORE_REPLACEMENTS, ...HABIT_PROGRESS_REPLACEMENTS].map(([from]) => [String(from).slice(0, 50), from]))(
    "finds its target in the calorie prompt: %s",
    (_label, from) => {
      if (typeof from === "string") expect(source.includes(from)).toBe(true);
      else expect((from as RegExp).test(source)).toBe(true);
    },
  );
});

describe("habit cycle and comp prep pieces", () => {
  it("cycle directives carry no calorie or macro percentages", () => {
    for (const phase of ["menstrual", "follicular", "ovulation", "luteal"]) {
      const d = habitCycleDirective(phase);
      expect(d).not.toBe("");
      // The advice itself (the closing rules may name what to avoid).
      const advice = d.split("IMPORTANT CYCLE COACHING RULES")[0];
      expect(containsNutritionNumbers(advice)).toBe(false);
      expect(advice).not.toMatch(/%/);
    }
  });

  it("comp prep keeps event, date and phase but drops calorie lines", () => {
    const section = "- Event: HYROX (Pro)\n- Event Date: 2027-03-01\n- Phase: Build (build)\n- Training Day Calories: 2600 kcal\n- Moderate deficits are acceptable";
    expect(dropCompPrepNutritionLines(section)).toBe("- Event: HYROX (Pro)\n- Event Date: 2027-03-01\n- Phase: Build (build)");
  });
});
