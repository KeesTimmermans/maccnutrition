import { describe, it, expect } from "vitest";
import {
  scoreProduct,
  nutritionLooksImplausible,
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
  ANIMAL_FLOOR,
  DARK_CHOCOLATE_FLOOR,
  GRAIN_CAP_REFINED,
  GRAIN_CAP_WHOLE,
  GRAIN_FIBRE_THRESHOLD,
  GRAIN_STAPLE_CATEGORIES,
  PILLAR_NOTE_KEYS,
  capLineKey,
  startsWithCocoa,
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
    if (f.todo) {
      it.todo(`${f.name} scores ${f.min}–${f.max} (${f.todo})`);
      continue;
    }
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
  /** Whether the whole-food floor (not the basic meat, fish and dairy floor) raised the score. */
  const floored = (input: ProductScoreInput) => {
    const r = scoreProduct(input);
    return r.floor.applied && r.floorKind === "whole_food";
  };

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
    expect(r.floorKind).not.toBe("whole_food");
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
    // "en:creams" and "en:processed-cheeses" exclude the whole-food and animal floors
    // without touching any pillar. (Dark chocolate has its own test below.)
    const notWhole = (input: ProductScoreInput) => ({
      ...input,
      categoriesTags: [...(input.categoriesTags ?? []), "en:creams", "en:processed-cheeses"],
    });
    for (const input of [cheese, ...FIXTURES.filter((f) => !f.name.startsWith("dark chocolate")).map((f) => f.input)]) {
      const withFloor = scoreProduct(input);
      const without = scoreProduct(notWhole(input));
      expect(without.floor.applied).toBe(false);
      expect(without.floorKind).toBeNull();
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

describe("nut and seed butters (saturated-fat pillar)", () => {
  const nutButter: ProductScoreInput = {
    sugars100g: 5,
    saturatedFat100g: 8,
    salt100g: 0.03,
    proteins100g: 28,
    ingredientsText: "Peanuts (100%)",
    novaGroup: 3,
    additivesTags: [],
    categoriesTags: ["en:spreads", "en:nut-butters"],
  };
  it("raises the pillar to at least 7 for nut-butter categories, with the nuts note", () => {
    for (const tag of ["en:nut-butters", "en:peanut-butters", "en:tahini", "en:seed-butters"]) {
      const p = pillar({ ...nutButter, categoriesTags: [tag] }, "satFat");
      expect(p.score).toBe(7);
      expect(p.noteKeys).toEqual(["pillar_note_nuts_oils"]);
    }
  });
  it("is a floor, not a fixed value: a lower-fat nut butter keeps its higher score", () => {
    const p = pillar({ ...nutButter, saturatedFat100g: 1 }, "satFat");
    expect(p.score).toBe(9);
    expect(p.noteKeys).toEqual([]);
  });
  it("also applies to plain products with at least 60% nuts and no category", () => {
    const plain = { ...nutButter, categoriesTags: ["en:spreads"], fruitVegNuts100g: 60 };
    expect(pillar(plain, "satFat").score).toBe(7);
    expect(pillar({ ...plain, fruitVegNuts100g: 59 }, "satFat").score).toBe(2);
    expect(pillar({ ...plain, ingredientsText: "Peanuts, sugar" }, "satFat").score).toBe(2);
    expect(pillar({ ...plain, additivesTags: ["en:e322"] }, "satFat").score).toBe(2);
  });
  it("does not apply to other categories", () => {
    expect(pillar({ ...nutButter, categoriesTags: ["en:spreads"] }, "satFat").score).toBe(2);
  });
});

describe("grain staple cap", () => {
  const rice: ProductScoreInput = {
    sugars100g: 0.5,
    saturatedFat100g: 0.3,
    salt100g: 0.01,
    fiber100g: 1.3,
    proteins100g: 7.5,
    ingredientsText: "Long Grain Rice",
    novaGroup: 1,
    additivesTags: [],
    categoriesTags: ["en:rices"],
  };
  const grainCap = (input: ProductScoreInput) => scoreProduct(input).caps.find((c) => c.id === "grain_staple");

  it("caps refined grains at 6 and whole grains at 8", () => {
    expect(scoreProduct(rice).score).toBe(GRAIN_CAP_REFINED);
    expect(grainCap(rice)).toEqual({ id: "grain_staple", limit: GRAIN_CAP_REFINED, applied: true });
    expect(scoreProduct({ ...rice, fiber100g: 8 }).score).toBe(GRAIN_CAP_WHOLE);
  });
  it("counts unknown fibre as refined, and fibre at the threshold as whole grain", () => {
    expect(grainCap({ ...rice, fiber100g: null })!.limit).toBe(GRAIN_CAP_REFINED);
    expect(grainCap({ ...rice, fiber100g: GRAIN_FIBRE_THRESHOLD })!.limit).toBe(GRAIN_CAP_WHOLE);
    expect(grainCap({ ...rice, fiber100g: 2.9 })!.limit).toBe(GRAIN_CAP_REFINED);
  });
  it("covers every grain category, but not breads or breakfast cereals", () => {
    for (const tag of GRAIN_STAPLE_CATEGORIES) expect(grainCap({ ...rice, categoriesTags: [tag] })).toBeDefined();
    expect(grainCap({ ...rice, categoriesTags: ["en:breads"] })).toBeUndefined();
    expect(grainCap({ ...rice, categoriesTags: ["en:breakfast-cereals"] })).toBeUndefined();
    expect(scoreProduct({ ...rice, categoriesTags: ["en:breads"] }).score).toBe(10);
  });
  it("is applied last, so it wins over the whole-food floor", () => {
    const salty = { ...rice, salt100g: 1.3 }; // weakest link → 5, whole-food floor → 7, grain cap → 6
    const r = scoreProduct(salty);
    expect(r.floorKind).toBe("whole_food");
    expect(r.floor.applied).toBe(true);
    expect(grainCap(salty)!.applied).toBe(true);
    expect(r.score).toBe(GRAIN_CAP_REFINED);
  });
  it("never raises a score, and is not marked applied when it didn't lower it", () => {
    const veryProcessed = { ...rice, novaGroup: 4, ingredientsText: "Rice, flavouring, E621", salt100g: 2.25 };
    const r = scoreProduct(veryProcessed);
    expect(r.score as number).toBeLessThan(GRAIN_CAP_REFINED);
    expect(grainCap(veryProcessed)!.applied).toBe(false);
  });
  it("never raises any fixture and never changes pillars, average or reasons", () => {
    for (const f of FIXTURES) {
      const tags = f.input.categoriesTags ?? [];
      const stripped = { ...f.input, categoriesTags: tags.filter((t) => !GRAIN_STAPLE_CATEGORIES.includes(t)) };
      const withCap = scoreProduct(f.input);
      const without = scoreProduct(stripped);
      expect(withCap.score as number).toBeLessThanOrEqual(without.score as number);
      expect(withCap.pillars).toEqual(without.pillars);
      expect(withCap.average).toBe(without.average);
      expect(withCap.reasons).toEqual(without.reasons);
    }
  });
  it("has its own line for refined and whole grains", () => {
    expect(capLineKey({ id: "grain_staple", limit: GRAIN_CAP_REFINED })).toBe("score_cap_grain_refined");
    expect(capLineKey({ id: "grain_staple", limit: GRAIN_CAP_WHOLE })).toBe("score_cap_grain_whole");
    expect(capLineKey({ id: "weakest_link", limit: 3 })).toBe("score_cap_weakest");
  });
});

describe("basic meat, fish and dairy floor", () => {
  const sausage = FIXTURES.find((f) => f.name === "pork sausages")!.input;
  const kind = (input: ProductScoreInput) => scoreProduct(input).floorKind;

  it("raises a basic, unsweetened meat, fish or dairy food to 6", () => {
    const r = scoreProduct(sausage);
    expect(r.floorKind).toBe("animal_food");
    expect(r.floor).toEqual({ limit: ANIMAL_FLOOR, applied: true });
    expect(r.score).toBe(ANIMAL_FLOOR);
  });
  it("does not apply outside the meat, fish and dairy categories", () => {
    expect(kind({ ...sausage, categoriesTags: ["en:snacks"] })).toBeNull();
  });
  it("does not apply when the sugar pillar is below 8", () => {
    const sweet = { ...sausage, sugars100g: 8, ingredientsText: `${sausage.ingredientsText}, Sugar` };
    expect(pillar(sweet, "sugar").score).toBeLessThan(8);
    expect(kind(sweet)).toBeNull();
  });
  it("does not apply to processed cheese", () => {
    expect(kind({ ...sausage, categoriesTags: ["en:cheeses", "en:processed-cheeses"] })).toBeNull();
  });
  it("does not apply to ready-made dishes", () => {
    for (const dish of ["en:salads", "en:meals", "en:sandwiches", "en:soups", "en:pizzas-pies-and-quiches"]) {
      expect(kind({ ...sausage, categoriesTags: ["en:meats", dish] })).toBeNull();
    }
  });
  it("loses to the whole-food floor of 7", () => {
    const r = scoreProduct(FIXTURES.find((f) => f.name === "mature cheddar")!.input);
    expect(r.floorKind).toBe("whole_food");
    expect(r.floor.limit).toBe(WHOLE_FOOD_FLOOR);
    expect(r.score).toBe(7);
  });
  it("never lowers a higher score", () => {
    const lean = { ...sausage, salt100g: 0.2, saturatedFat100g: 1, novaGroup: 3, additivesTags: [], ingredientsText: "Pork, salt" };
    const r = scoreProduct(lean);
    expect(r.floorKind).toBe("animal_food");
    expect(r.floor.applied).toBe(false);
    expect(r.score as number).toBeGreaterThan(ANIMAL_FLOOR);
  });
});

describe("high-cocoa dark chocolate", () => {
  const dark = FIXTURES.find((f) => f.name === "dark chocolate 85%")!.input;

  it("raises the saturated-fat pillar to 7 and the final score to 6", () => {
    const r = scoreProduct(dark);
    const satFat = r.pillars.find((p) => p.id === "satFat")!;
    expect(satFat.score).toBe(7);
    expect(satFat.noteKeys).toEqual([PILLAR_NOTE_KEYS.cocoaFat]);
    expect(r.floorKind).toBe("dark_chocolate");
    expect(r.floor).toEqual({ limit: DARK_CHOCOLATE_FLOOR, applied: true });
    expect(r.score).toBe(DARK_CHOCOLATE_FLOOR);
  });
  it("does not apply when cocoa is not the first ingredient", () => {
    const r = scoreProduct({ ...dark, ingredientsText: "Sugar, Cocoa Mass, Cocoa Butter" });
    expect(r.floorKind).toBeNull();
    expect(r.pillars.find((p) => p.id === "satFat")!.score).toBe(1);
  });
  it("does not apply above 30 g sugar", () => {
    expect(scoreProduct({ ...dark, sugars100g: 31 }).floorKind).toBeNull();
    expect(scoreProduct({ ...dark, sugars100g: 30 }).floorKind).toBe("dark_chocolate");
  });
  it("does not apply to milk chocolate, even with cocoa first", () => {
    const milk = { ...dark, categoriesTags: ["en:chocolates", "en:milk-chocolates"] };
    expect(scoreProduct(milk).floorKind).toBeNull();
    expect(scoreProduct(FIXTURES.find((f) => f.name === "milk chocolate bar")!.input).floorKind).toBeNull();
  });
  it("recognises cocoa mass, cocoa paste and cocoa as the first ingredient", () => {
    expect(startsWithCocoa("Cocoa Mass, Sugar")).toBe(true);
    expect(startsWithCocoa("Cocoa paste 70%, sugar")).toBe(true);
    expect(startsWithCocoa("Cocoa (85%), sugar")).toBe(true);
    expect(startsWithCocoa("Cocoa Butter, Sugar")).toBe(false);
    expect(startsWithCocoa("Sugar, Cocoa Mass")).toBe(false);
  });
  it("never lowers a higher score", () => {
    const better = { ...dark, novaGroup: 3, additivesTags: [], ingredientsText: "Cocoa mass, cocoa butter, sugar" };
    const r = scoreProduct(better);
    expect(r.floorKind).toBe("dark_chocolate");
    expect(r.floor.applied).toBe(false);
    expect(r.score as number).toBeGreaterThan(DARK_CHOCOLATE_FLOOR);
  });
});

describe("fruit juice and smoothies (sugar pillar)", () => {
  const juice = FIXTURES.find((f) => f.name === "orange juice not from concentrate")!.input;
  const asOtherDrink = { ...juice, categoriesTags: ["en:beverages", "en:fruit-based-beverages"] };

  it("counts juice and smoothie sugar in full, with a note", () => {
    for (const tag of ["en:fruit-juices", "en:smoothies"]) {
      const p = pillar({ ...juice, categoriesTags: ["en:beverages", tag] }, "sugar");
      expect(p.raw).toBe(oneDecimal(interpolate(8.5, SUGAR_ANCHORS_DRINK)));
      expect(p.noteKeys).toEqual([PILLAR_NOTE_KEYS.juiceSugar]);
    }
  });
  it("a non-juice drink keeps the natural-sugar halving", () => {
    const p = pillar(asOtherDrink, "sugar");
    expect(p.raw).toBe(oneDecimal(interpolate(8.5 * 0.5, SUGAR_ANCHORS_DRINK)));
    expect(p.noteKeys).toEqual([PILLAR_NOTE_KEYS.naturalSugar]);
    expect(p.raw).toBeGreaterThan(pillar(juice, "sugar").raw);
  });
  it("shows the note only when halving would have raised the score", () => {
    expect(pillar({ ...juice, sugars100g: 0 }, "sugar").noteKeys).toEqual([]);
    expect(pillar({ ...juice, ingredientsText: "Orange juice, sugar" }, "sugar").noteKeys).not.toContain(
      PILLAR_NOTE_KEYS.juiceSugar,
    );
  });
});

const oneDecimal = (v: number) => Math.round(v * 10) / 10;

describe("nutritionLooksImplausible", () => {
  it("accepts plausible data and ignores nulls", () => {
    expect(nutritionLooksImplausible({ sugars100g: 10, carbohydrates100g: 50, fat100g: 20, saturatedFat100g: 8, proteins100g: 7, salt100g: 0.5, energyKcal100g: 450 })).toBe(false);
    expect(nutritionLooksImplausible({ sugars100g: null, fat100g: null })).toBe(false);
    expect(nutritionLooksImplausible({ sugars100g: 10 })).toBe(false); // carbs unknown
  });
  it("flags negative or over-100 g values and kcal over 900", () => {
    expect(nutritionLooksImplausible({ salt100g: -1 })).toBe(true);
    expect(nutritionLooksImplausible({ proteins100g: 120 })).toBe(true);
    expect(nutritionLooksImplausible({ energyKcal100g: 950 })).toBe(true);
    expect(nutritionLooksImplausible({ energyKcal100g: 900 })).toBe(false);
  });
  it("flags a macro sum over 105", () => {
    expect(nutritionLooksImplausible({ fat100g: 50, carbohydrates100g: 50, proteins100g: 10 })).toBe(true);
    expect(nutritionLooksImplausible({ fat100g: 50, carbohydrates100g: 50, proteins100g: 5 })).toBe(false);
  });
  it("flags sugars above carbs and sat fat above fat (by more than 1)", () => {
    expect(nutritionLooksImplausible({ sugars100g: 12, carbohydrates100g: 10 })).toBe(true);
    expect(nutritionLooksImplausible({ sugars100g: 11, carbohydrates100g: 10 })).toBe(false);
    expect(nutritionLooksImplausible({ saturatedFat100g: 9, fat100g: 5 })).toBe(true);
  });
  it("scoreProduct treats implausible data as provisional with the data_looks_off reason", () => {
    const r = scoreProduct({ sugars100g: 30, carbohydrates100g: 5, ingredientsText: "oats", novaGroup: 1, additivesTags: [] });
    expect(r.provisional).toBe(true);
    expect(r.confidence).toBe("limited");
    expect(r.reasons[0]).toBe(REASON_KEYS.dataLooksOff);
  });
});

describe("pure honey and the whole-food floor", () => {
  const honey = FIXTURES.find((f) => f.name === "pure honey")!.input;
  const sugarPillar = (input: ProductScoreInput) => scoreProduct(input).pillars.find((p) => p.id === "sugar")?.score;
  const unexemptSugar = sugarPillar({ ...honey, categoriesTags: ["en:sweeteners", "en:spreads"] });

  for (const nova of [1, 2, 3, null] as const) {
    it(`scores 7 with the whole-food floor at NOVA ${nova ?? "missing"}`, () => {
      const r = scoreProduct({ ...honey, novaGroup: nova });
      expect(r.score).toBe(WHOLE_FOOD_FLOOR);
      expect(r.floorKind).toBe("whole_food");
      expect(r.floor.applied).toBe(true);
      expect(sugarPillar({ ...honey, novaGroup: nova })).toBe(unexemptSugar);
      expect(sugarPillar({ ...honey, novaGroup: nova })).toBeLessThan(WHOLE_FOOD_FLOOR);
    });
  }
  it("honey with glucose syrup is not floored", () => {
    const r = scoreProduct(FIXTURES.find((f) => f.name === "honey with glucose syrup")!.input);
    expect(r.floorKind).not.toBe("whole_food");
    expect(r.score).toBe(3);
  });
  it("a granola listing honey is not floored", () => {
    const r = scoreProduct({
      sugars100g: 20, saturatedFat100g: 2, salt100g: 0.1, fiber100g: 7, proteins100g: 9,
      ingredientsText: "Oat Flakes, Honey", ingredientsN: 2, novaGroup: 3, additivesTags: [],
      categoriesTags: ["en:breakfast-cereals", "en:granolas", "en:honeys"],
    });
    expect(r.floorKind).not.toBe("whole_food");
  });
});
