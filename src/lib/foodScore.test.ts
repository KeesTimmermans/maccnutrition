import { describe, it, expect } from "vitest";
import {
  scoreProduct,
  interpolate,
  REASON_KEYS,
  SUGAR_ANCHORS_FOOD,
  SUGAR_ANCHORS_DRINK,
  SALT_ANCHORS,
  hasSugarInFirstIngredients,
  hasArtificialSweetener,
  countAdditives,
  SCORING_GUIDE,
  WHOLE_FOOD_FLOOR,
  type ProductScoreInput,
  type PillarId,
} from "./foodScore";
import { FIXTURES } from "./foodScore.fixtures";

const pillar = (input: ProductScoreInput, id: PillarId) => {
  const p = scoreProduct(input).pillars.find((x) => x.id === id);
  if (!p) throw new Error(`no pillar ${id}`);
  return p;
};
const appliedCaps = (input: ProductScoreInput) =>
  scoreProduct(input)
    .caps.filter((c) => c.applied)
    .map((c) => c.id);

/** Clean, fully known food: every pillar high, nothing flagged. */
const clean: ProductScoreInput = {
  sugars100g: 0,
  saturatedFat100g: 0,
  salt100g: 0,
  proteins100g: 20,
  ingredientsText: "Oats",
  novaGroup: 1,
  additivesTags: [],
  categoriesTags: ["en:cereals"],
};

describe("fixture ranges", () => {
  for (const f of FIXTURES) {
    it(`${f.name} scores ${f.min}–${f.max}`, () => {
      const r = scoreProduct(f.input);
      expect(r.score).not.toBeNull();
      expect(r.score as number).toBeGreaterThanOrEqual(f.min);
      expect(r.score as number).toBeLessThanOrEqual(f.max);
      if (f.floorApplied !== undefined) expect(r.floor.applied).toBe(f.floorApplied);
    });
  }

  it("mature cheddar keeps low salt and saturated fat pillars but is raised to 7", () => {
    const r = scoreProduct(FIXTURES.find((f) => f.name === "mature cheddar")!.input);
    expect(r.pillars.find((p) => p.id === "salt")!.score).toBeLessThanOrEqual(3);
    expect(r.pillars.find((p) => p.id === "satFat")!.score).toBeLessThanOrEqual(3);
    expect(r.score).toBe(7);
    expect(r.floor).toEqual({ limit: WHOLE_FOOD_FLOOR, applied: true });
    expect(r.reasons).toContain(REASON_KEYS.highSalt);
  });

  it("diet cola scores the same with proper additive tags as with empty ones", () => {
    const empty = FIXTURES.find((f) => f.name.startsWith("diet cola"))!.input;
    const tagged = { ...empty, additivesTags: ["en:e150d", "en:e338", "en:e950", "en:e951"] };
    expect(scoreProduct(tagged).score).toBe(scoreProduct(empty).score);
    expect(scoreProduct(empty).score as number).toBeLessThanOrEqual(6);
  });
});

describe("interpolate", () => {
  it("is linear between anchors and exact on them", () => {
    expect(interpolate(5, SUGAR_ANCHORS_FOOD)).toBe(8);
    expect(interpolate(7.5, SUGAR_ANCHORS_FOOD)).toBe(7);
    expect(interpolate(0.45, SALT_ANCHORS)).toBe(8);
  });
  it("clamps to the end scores outside the range", () => {
    expect(interpolate(-3, SUGAR_ANCHORS_FOOD)).toBe(10);
    expect(interpolate(0, SUGAR_ANCHORS_FOOD)).toBe(10);
    expect(interpolate(80, SUGAR_ANCHORS_FOOD)).toBe(1);
  });
});

describe("sugar pillar", () => {
  const added = { ...clean, ingredientsText: "Water, salt, lemon, sugar" };

  it("drinks use half of every sugar value", () => {
    expect(SUGAR_ANCHORS_DRINK.map(([x]) => x)).toEqual([0.5, 2.5, 5, 7.5, 11.25]);
    expect(pillar({ ...added, sugars100g: 5 }, "sugar").raw).toBe(8);
    expect(pillar({ ...added, sugars100g: 5, categoriesTags: ["en:beverages"] }, "sugar").raw).toBe(6);
  });

  it("counts half the sugar when the ingredients list no sugar-type ingredient", () => {
    expect(pillar({ ...clean, sugars100g: 10, ingredientsText: "Milk" }, "sugar").raw).toBe(8); // as 5g
    expect(pillar({ ...added, sugars100g: 10 }, "sugar").raw).toBe(6); // full 10g
    expect(pillar({ ...clean, sugars100g: 10, ingredientsText: null }, "sugar").raw).toBe(6); // no text: full
  });

  it("costs a point when sugar is among the first 3 ingredients, never below 1", () => {
    expect(pillar({ ...clean, sugars100g: 5, ingredientsText: "Oats, sugar, salt" }, "sugar").raw).toBe(7);
    expect(pillar({ ...clean, sugars100g: 5, ingredientsText: "Oats, water, salt, sugar" }, "sugar").raw).toBe(8);
    expect(pillar({ ...clean, sugars100g: 60, ingredientsText: "Sugar, cocoa" }, "sugar").raw).toBe(1);
    expect(hasSugarInFirstIngredients("Chicken (water, sugar), rice, peas")).toBe(false);
  });
});

describe("saturated fat exceptions", () => {
  const fatty = { ...clean, saturatedFat100g: 14 };
  it("fixes nuts, seeds and plant oils at 7", () => {
    expect(pillar({ ...fatty, categoriesTags: ["en:vegetable-oils", "en:olive-oils"] }, "satFat").score).toBe(7);
    expect(pillar({ ...fatty, categoriesTags: ["en:nuts"] }, "satFat").score).toBe(7);
  });
  it("gives plain milk and yoghurt a floor of 5, but not sweetened ones", () => {
    expect(pillar({ ...fatty, categoriesTags: ["en:yogurts"], ingredientsText: "Milk, cultures" }, "satFat").score).toBe(5);
    expect(pillar({ ...fatty, categoriesTags: ["en:milks"], ingredientsText: "Milk" }, "satFat").score).toBe(5);
    expect(pillar({ ...fatty, categoriesTags: ["en:yogurts"], ingredientsText: "Milk, sugar" }, "satFat").score).toBe(1);
  });
});

describe("processing pillar", () => {
  const noNova = { ...clean, novaGroup: null };
  it("infers NOVA 4 from markers or 3+ E-numbers in the text when tags are empty", () => {
    expect(countAdditives([], "Water, E330, E 202, e211b")).toBe(3);
    const eNumbers = pillar({ ...noNova, ingredientsText: "Water, acid (E330), preservatives (E202, E211)" }, "processing");
    expect(eNumbers.score).toBe(3); // NOVA 4 (3) − 1 additives + 1 short list
    expect(pillar({ ...noNova, ingredientsText: "Water, flavouring" }, "processing").score).toBe(4); // 3 + 1 short list
  });
  it("infers NOVA 3 from 1–2 additives, otherwise unknown", () => {
    expect(pillar({ ...noNova, ingredientsText: "Tomatoes, acid (E330)" }, "processing").score).toBe(7); // 6 + 1
    const unknown = pillar({ ...noNova, ingredientsText: "Tomatoes, basil" }, "processing");
    expect(unknown.known).toBe(false);
    expect(unknown.score).toBe(5);
  });
  it("applies sweetener, additive and ingredient-count adjustments", () => {
    const long = Array.from({ length: 16 }, (_, i) => `ingredient${i}`).join(", ");
    expect(pillar({ ...clean, novaGroup: 3, ingredientsText: long }, "processing").score).toBe(5); // 6 − 1
    const sixAdditives = ["en:e100", "en:e101", "en:e102", "en:e110", "en:e120", "en:e129"];
    expect(pillar({ ...clean, novaGroup: 4, additivesTags: sixAdditives, ingredientsText: long }, "processing").score).toBe(1);
    expect(pillar({ ...clean, novaGroup: 3, additivesTags: ["en:e955"] }, "processing").score).toBe(6); // 6 − 1 + 1
  });
  it("detects sweeteners from tags, or from names and E-numbers in the text when tags are missing", () => {
    expect(hasArtificialSweetener(["en:e966"], null)).toBe(true);
    expect(hasArtificialSweetener([], "Water, sweetener (sucralose)")).toBe(true);
    expect(hasArtificialSweetener(null, "Water, E950")).toBe(true);
    expect(hasArtificialSweetener([], "Water, sugar")).toBe(false);
  });
});

describe("protein & fibre pillar", () => {
  it("uses the highest signal with data", () => {
    const p = pillar({ ...clean, proteins100g: 3, fiber100g: 6, fruitVegNuts100g: 20 }, "proteinFibre");
    expect(p.raw).toBe(9);
    expect(p.noteKeys).toEqual([REASON_KEYS.fibre]);
  });
  it("is skipped for drinks, so the average uses the other four", () => {
    const drink = scoreProduct({ ...clean, proteins100g: 0, categoriesTags: ["en:beverages"] });
    const pf = drink.pillars.find((p) => p.id === "proteinFibre")!;
    expect(pf.applicable).toBe(false);
    expect(drink.average).toBe(10); // sugar 10, salt 10, sat fat 10, processing 10
    expect(drink.provisional).toBe(false);
  });
  it("never triggers the weakest-link cap", () => {
    const r = scoreProduct({ ...clean, proteins100g: 0, fiber100g: 0 }); // protein & fibre 4
    expect(r.caps.map((c) => c.id)).not.toContain("weakest_link");
    expect(r.score).toBe(9);
  });
});

describe("unknown data", () => {
  it("unknown pillar counts as 5, marks provisional and caps at 7", () => {
    const r = scoreProduct({ ...clean, salt100g: null });
    const salt = r.pillars.find((p) => p.id === "salt")!;
    expect(salt).toMatchObject({ known: false, score: 5 });
    expect(r.provisional).toBe(true);
    expect(r.score).toBe(7);
    expect(appliedCaps({ ...clean, salt100g: null })).toEqual(["provisional"]);
  });
  it("no data at all gives no score and confidence none", () => {
    expect(scoreProduct({})).toMatchObject({ score: null, band: null, reasons: [], confidence: "none" });
  });
  it("limited confidence (no ingredient info) is provisional", () => {
    const r = scoreProduct({ sugars100g: 0, saturatedFat100g: 0, salt100g: 0, proteins100g: 20 });
    expect(r.confidence).toBe("limited");
    expect(r.provisional).toBe(true);
    expect(r.score as number).toBeLessThanOrEqual(7);
  });
});

describe("caps", () => {
  // One additive in the text keeps every pillar the same but stops the whole-food floor hiding the cap.
  const withSalt = (salt100g: number) => ({ ...clean, ingredientsText: "Oats, antioxidant (E306)", salt100g });
  it("weakest link: 1 → 3, 2 → 4, 3 → 5", () => {
    expect(pillar(withSalt(2.25), "salt").score).toBe(1);
    expect(scoreProduct(withSalt(2.25)).score).toBe(3);
    expect(pillar(withSalt(1.5), "salt").score).toBe(2);
    expect(scoreProduct(withSalt(1.5)).score).toBe(4);
    expect(pillar(withSalt(1.3), "salt").score).toBe(3);
    expect(scoreProduct(withSalt(1.3)).score).toBe(5);
    expect(appliedCaps(withSalt(1.3))).toEqual(["weakest_link"]);
  });
  it("artificial sweeteners cap at 6", () => {
    const r = scoreProduct({ ...clean, additivesTags: ["en:e955"] });
    expect(r.score).toBe(6);
    expect(appliedCaps({ ...clean, additivesTags: ["en:e955"] })).toEqual(["sweeteners"]);
  });
  it("marks only the cap that lowered the score as applied", () => {
    const r = scoreProduct({ ...clean, salt100g: 2.25, additivesTags: ["en:e955"] });
    expect(r.score).toBe(3);
    expect(r.caps.map((c) => [c.id, c.applied])).toEqual([
      ["weakest_link", true],
      ["sweeteners", false],
    ]);
    expect(scoreProduct(FIXTURES[0].input).caps.every((c) => c.id !== "sweeteners")).toBe(true);
  });
});

describe("reasons and guide", () => {
  it("lists worst pillars first, then the best positive, max 3", () => {
    const r = scoreProduct({ ...clean, sugars100g: 30, ingredientsText: "Sugar, oats, salt", salt100g: 0.9 });
    expect(r.reasons).toEqual([REASON_KEYS.highSugar, REASON_KEYS.sugarFirst, REASON_KEYS.someSalt]);
    expect(scoreProduct(clean).reasons).toEqual([REASON_KEYS.protein, REASON_KEYS.lowSugarSaltFat]);
  });
  it("is deterministic", () => {
    for (const f of FIXTURES) expect(scoreProduct(f.input)).toEqual(scoreProduct(f.input));
  });
  it("guide is built from the pillar weights and caps", () => {
    expect(SCORING_GUIDE.pillars.filter((p) => p.countsDouble).map((p) => p.id)).toEqual(["sugar", "processing"]);
    expect(SCORING_GUIDE.bands.map((b) => [b.min, b.max])).toEqual([
      [7, 10],
      [4, 6],
      [1, 3],
    ]);
  });
});

describe("whole-food floor", () => {
  /** Plain cheese: salt and saturated fat cap it at 3 without the floor. */
  const cheese: ProductScoreInput = {
    sugars100g: 0.1,
    saturatedFat100g: 21.7,
    salt100g: 1.8,
    proteins100g: 25,
    ingredientsText: "Cheddar Cheese (Milk)",
    novaGroup: 3,
    additivesTags: [],
    categoriesTags: ["en:dairies", "en:cheeses"],
  };
  const floored = (input: ProductScoreInput) => scoreProduct(input).floor.applied;

  it("raises a plain whole food to 7", () => {
    const r = scoreProduct(cheese);
    expect(r.wholeFood).toBe(true);
    expect(r.score).toBe(WHOLE_FOOD_FLOOR);
    expect(r.band).toBe("good");
    expect(r.floor.applied).toBe(true);
  });
  it("applies to any NOVA 1 food, whatever its category", () => {
    expect(floored({ ...cheese, novaGroup: 1, categoriesTags: ["en:snacks"] })).toBe(true);
  });
  it("does not apply to NOVA 4", () => {
    expect(floored({ ...cheese, novaGroup: 4 })).toBe(false);
  });
  it("does not apply when NOVA is unknown", () => {
    const r = scoreProduct({ ...cheese, novaGroup: null });
    expect(r.wholeFood).toBe(false);
    expect(r.floor.applied).toBe(false);
  });
  it("does not apply with additives in the tags or as E-numbers in the text", () => {
    expect(floored({ ...cheese, additivesTags: ["en:e160b"] })).toBe(false);
    expect(floored({ ...cheese, ingredientsText: "Cheddar Cheese (Milk), Colour (E160b)" })).toBe(false);
  });
  it("does not apply with an artificial sweetener", () => {
    expect(floored({ ...cheese, ingredientsText: "Cheddar Cheese (Milk), Sweetener (Sucralose)" })).toBe(false);
  });
  it("does not apply when a sugar-type ingredient is listed", () => {
    expect(floored({ ...cheese, ingredientsText: "Cheddar Cheese (Milk), Sugar" })).toBe(false);
  });
  it("does not apply in an excluded category", () => {
    expect(floored({ ...cheese, categoriesTags: ["en:cheeses", "en:processed-cheeses"] })).toBe(false);
  });
  it("does not apply when the category is not a whole-food one and NOVA is not 1", () => {
    expect(floored({ ...cheese, categoriesTags: ["en:snacks"] })).toBe(false);
  });
  it("does not apply to NOVA 2–3 whole-food categories with more than 5 ingredients", () => {
    expect(floored({ ...cheese, ingredientsN: 6 })).toBe(false);
    expect(floored({ ...cheese, ingredientsN: 5 })).toBe(true);
  });
  it("does not apply when confidence is none", () => {
    const r = scoreProduct({ categoriesTags: ["en:cheeses"], novaGroup: null });
    expect(r.confidence).toBe("none");
    expect(r.score).toBeNull();
    expect(r.floor.applied).toBe(false);
  });
  it("never lowers a score and never changes pillars, average, caps or reasons", () => {
    // "en:creams" excludes the floor without touching any pillar.
    const notWhole = (input: ProductScoreInput) => ({
      ...input,
      categoriesTags: [...(input.categoriesTags ?? []), "en:creams"],
    });
    for (const input of [cheese, ...FIXTURES.map((f) => f.input)]) {
      const withFloor = scoreProduct(input);
      const without = scoreProduct(notWhole(input));
      expect(without.floor.applied).toBe(false);
      expect(withFloor.score as number).toBeGreaterThanOrEqual(without.score as number);
      expect(withFloor.pillars).toEqual(without.pillars);
      expect(withFloor.average).toBe(without.average);
      expect(withFloor.caps).toEqual(without.caps);
      expect(withFloor.reasons).toEqual(without.reasons);
    }
  });
  it("guide note uses the floor constant", () => {
    expect(SCORING_GUIDE.wholeFood.values.limit).toBe(WHOLE_FOOD_FLOOR);
  });
});
