import { describe, expect, it } from "vitest";
import { countFilled, labelToScoreInput, saltFromReading, toPer100g } from "./labelReading";
import { scoreProduct } from "./foodScore";

describe("labelReading", () => {
  it("uses salt as printed", () => expect(saltFromReading(1.2, 0.8)).toBe(1.2));
  it("converts sodium to salt x2.5", () => expect(saltFromReading(null, 0.4)).toBe(1));
  it("salt null when neither shown", () => expect(saltFromReading(null, null)).toBeNull());

  it("keeps per-100g values", () => {
    const v = toPer100g({ per100gOrPerServing: "per100g", sugarsG: 12, sodiumG: 0.2, ingredientsText: " oats " });
    expect(v.sugarsG).toBe(12);
    expect(v.saltG).toBe(0.5);
    expect(v.ingredientsText).toBe("oats");
  });

  it("scales per-serving to per-100g", () => {
    const v = toPer100g({ per100gOrPerServing: "perServing", servingSizeG: 30, sugarsG: 3, proteinG: 6, sodiumG: 0.12 });
    expect(v.sugarsG).toBe(10);
    expect(v.proteinG).toBe(20);
    expect(v.saltG).toBe(1);
  });

  it("per-serving without serving size gives nulls", () => {
    const v = toPer100g({ per100gOrPerServing: "perServing", servingSizeG: null, sugarsG: 3, saltG: 1 });
    expect(v.sugarsG).toBeNull();
    expect(v.saltG).toBeNull();
  });

  it("drops negative and non-numeric values", () => {
    const v = toPer100g({ per100gOrPerServing: "per100g", sugarsG: -1, fatG: "abc" as unknown as number });
    expect(v.sugarsG).toBeNull();
    expect(v.fatG).toBeNull();
  });

  it("counts filled fields", () => {
    const v = toPer100g({ per100gOrPerServing: "per100g", sugarsG: 1, saltG: 0, ingredientsText: "x" });
    expect(countFilled(v)).toBe(3);
  });

  it("score input has no categories or NOVA", () => {
    const input = labelToScoreInput(toPer100g({ per100gOrPerServing: "per100g", sugarsG: 5 }));
    expect(input.categoriesTags).toBeNull();
    expect(input.novaGroup).toBeNull();
    expect(input.sugars100g).toBe(5);
  });

  it("implausible label values make the score provisional", () => {
    const input = labelToScoreInput(toPer100g({
      per100gOrPerServing: "per100g", sugarsG: 80, carbsG: 20, fatG: 1, proteinG: 1, saltG: 0.1, energyKcal: 100, ingredientsText: "sugar",
    }));
    expect(scoreProduct(input).provisional).toBe(true);
  });
});
