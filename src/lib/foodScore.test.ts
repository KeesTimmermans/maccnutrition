import { describe, it, expect } from "vitest";
import { scoreProduct, REASON_KEYS, hasSugarInFirstIngredients } from "./foodScore";

const inRange = (v: number | null, min: number, max: number) => {
  expect(v).not.toBeNull();
  expect(v as number).toBeGreaterThanOrEqual(min);
  expect(v as number).toBeLessThanOrEqual(max);
};

describe("scoreProduct fixtures", () => {
  it("classic sugary cola scores 1–3", () => {
    const r = scoreProduct({
      sugars100g: 10.6,
      saturatedFat100g: 0,
      salt100g: 0,
      ingredientsText: "Carbonated water, sugar, colour (caramel E150d), acid (phosphoric acid), natural flavourings, caffeine",
      novaGroup: 4,
      additivesTags: ["en:e150d", "en:e338"],
      categoriesTags: ["en:beverages", "en:carbonated-drinks", "en:sodas", "en:colas"],
    });
    inRange(r.score, 1, 3);
    expect(r.band).toBe("occasional");
    expect(r.confidence).toBe("full");
    expect(r.reasons).toContain(REASON_KEYS.highSugar);
  });

  it("chocolate biscuit scores 1–3", () => {
    const r = scoreProduct({
      sugars100g: 28,
      saturatedFat100g: 14,
      salt100g: 0.8,
      fiber100g: 3,
      proteins100g: 6,
      ingredientsText: "Wheat flour, sugar, palm oil, cocoa mass, glucose syrup, raising agents (E500, E503), salt, emulsifier (soya lecithin)",
      novaGroup: 4,
      additivesTags: ["en:e322", "en:e500", "en:e503"],
      categoriesTags: ["en:snacks", "en:biscuits"],
    });
    inRange(r.score, 1, 3);
  });

  it("wholemeal bread scores 5–8", () => {
    const r = scoreProduct({
      sugars100g: 3,
      saturatedFat100g: 0.4,
      salt100g: 1.0,
      fiber100g: 6.5,
      proteins100g: 10,
      ingredientsText: "Wholemeal wheat flour, water, yeast, salt, vegetable oil, emulsifier (E472e), flour treatment agent (E300)",
      novaGroup: 4,
      additivesTags: ["en:e472e", "en:e300"],
      categoriesTags: ["en:breads"],
    });
    inRange(r.score, 5, 8);
  });

  it("plain porridge oats score 9–10", () => {
    const r = scoreProduct({
      sugars100g: 1,
      saturatedFat100g: 1.5,
      salt100g: 0.01,
      fiber100g: 9,
      proteins100g: 11,
      ingredientsText: "Wholegrain rolled oats (100%)",
      novaGroup: 1,
      additivesTags: [],
      categoriesTags: ["en:breakfast-cereals", "en:oat-flakes"],
    });
    inRange(r.score, 9, 10);
    expect(r.band).toBe("good");
  });

  it("natural Greek yoghurt scores 6–9", () => {
    const r = scoreProduct({
      sugars100g: 4,
      saturatedFat100g: 6.5,
      salt100g: 0.1,
      proteins100g: 5.7,
      ingredientsText: "Pasteurised cow's milk, live yoghurt cultures",
      novaGroup: 1,
      additivesTags: [],
      categoriesTags: ["en:dairies", "en:yogurts", "en:greek-yogurts"],
    });
    inRange(r.score, 6, 9);
  });

  it("product with no data has score null and confidence none", () => {
    const r = scoreProduct({});
    expect(r).toEqual({ score: null, band: null, reasons: [], confidence: "none" });
  });

  it("sugars but no ingredient text gives limited confidence and skips ingredient rules", () => {
    const r = scoreProduct({
      sugars100g: 2,
      saturatedFat100g: 0,
      salt100g: 0,
      additivesTags: ["en:e950", "en:e951", "en:e330"],
    });
    expect(r.confidence).toBe("limited");
    expect(r.score).toBe(8);
    expect(r.reasons).not.toContain(REASON_KEYS.sweeteners);
    expect(r.reasons).not.toContain(REASON_KEYS.ultraProcessed);
  });
});

describe("scoreProduct rules", () => {
  const plain = { saturatedFat100g: 0, salt100g: 0, ingredientsText: "water", novaGroup: 1 };

  it("drinks use half of each sugar threshold", () => {
    const food = scoreProduct({ ...plain, sugars100g: 6 });
    const drink = scoreProduct({ ...plain, sugars100g: 6, categoriesTags: ["en:beverages"] });
    expect(food.score).toBe(7); // >5 → −1
    expect(drink.score).toBe(6); // >5 (half of 10) → −2
  });

  it("sugar among the first 3 ingredients costs a point, later on it doesn't", () => {
    const first = scoreProduct({ ...plain, sugars100g: 1, ingredientsText: "Oats, glucose-fructose syrup, salt" });
    const later = scoreProduct({ ...plain, sugars100g: 1, ingredientsText: "Oats, water, salt, honey" });
    expect(first.score).toBe(7);
    expect(first.reasons).toContain(REASON_KEYS.sugarFirst);
    expect(later.score).toBe(8);
  });

  it("ignores sugar inside a bracketed sub-ingredient list", () => {
    expect(hasSugarInFirstIngredients("Chicken (water, sugar), rice, peas")).toBe(false);
  });

  it("clamps at 1 for the worst products", () => {
    const r = scoreProduct({
      sugars100g: 50,
      saturatedFat100g: 20,
      salt100g: 3,
      ingredientsText: "Sugar, glucose syrup, palm fat",
      additivesTags: ["en:e950", "en:e129", "en:e102"],
    });
    expect(r.score).toBe(1);
  });

  it("clamps at 10 for the best products and limits reasons to 3", () => {
    const r = scoreProduct({
      ...plain,
      sugars100g: 0,
      fiber100g: 12,
      proteins100g: 20,
      fruitVegNuts100g: 100,
    });
    expect(r.score).toBe(10);
    expect(r.reasons.length).toBeLessThanOrEqual(3);
  });

  it("missing NOVA with 3+ additives counts as ultra-processed", () => {
    const r = scoreProduct({
      sugars100g: 0,
      salt100g: 0,
      saturatedFat100g: 0,
      ingredientsText: "Water, thickener, stabiliser, flavouring",
      additivesTags: ["en:e415", "en:e412", "en:e330"],
    });
    expect(r.score).toBe(5); // 8 − 2 (NOVA 4) − 1 (additives)
    expect(r.reasons).toContain(REASON_KEYS.ultraProcessed);
  });

  it("artificial sweeteners cost a point", () => {
    const r = scoreProduct({ ...plain, sugars100g: 0, additivesTags: ["en:e955"] });
    expect(r.score).toBe(7);
    expect(r.reasons).toContain(REASON_KEYS.sweeteners);
  });
});
