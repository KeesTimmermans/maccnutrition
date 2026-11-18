import { describe, it, expect } from "vitest";
import { pickAlternatives, type AlternativeCandidate } from "./productAlternatives";
import { REASON_KEYS } from "./foodScore";

/** A clean, unprocessed product that scores 9 with nothing to flag. */
const product = (code: string, name: string, over: Partial<AlternativeCandidate> = {}): AlternativeCandidate => ({
  found: true,
  code,
  product_name: name,
  brands: null,
  ingredients_text: "water",
  nova_group: 1,
  additives_tags: [],
  categories_tags: ["en:foods", "en:spreads"],
  stores_tags: [],
  inStore: false,
  ...over,
  nutriments: {
    sugars_100g: 1,
    saturated_fat_100g: 0,
    salt_100g: 0,
    fiber_100g: 0,
    proteins_100g: 0,
    ...(over.nutriments ?? {}),
  },
});

const scanned = { barcode: "3017620422003", score: 4, categoriesTags: ["en:foods", "en:spreads", "en:nut-spreads"] };

describe("pickAlternatives", () => {
  it("keeps only products at least 2 points better and scoring 6+", () => {
    // Salt in the "high" range caps at 5 (weakest link); sweeteners cap at 6.
    const five = product("1001", "Five", { nutriments: { salt_100g: 1.3 } as never });
    const six = product("1002", "Six", { additives_tags: ["en:e951"] });
    const nine = product("1003", "Nine");
    const r = pickAlternatives(scanned, [five, six, nine]);
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["1003", "1002"]);
    expect(r.alternatives.map((a) => a.score)).toEqual([9, 6]);

    const fromFive = pickAlternatives({ ...scanned, score: 5 }, [six, nine]);
    expect(fromFive.alternatives.map((a) => a.product.code)).toEqual(["1003"]); // 6 is only +1
  });

  it("ranks store-tagged items first, then by score", () => {
    const best = product("2001", "Best", { nutriments: { fiber_100g: 7 } as never }); // 10
    const store = product("2002", "Store", { inStore: true }); // 9
    const r = pickAlternatives(scanned, [best, store], "tesco");
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["2002", "2001"]);
    expect(r.anyInStore).toBe(true);
    expect(r.usedStore).toBe("tesco");
  });

  it("ignores inStore when no store is chosen", () => {
    const best = product("2101", "Best", { nutriments: { fiber_100g: 7 } as never });
    const store = product("2102", "Store", { inStore: true });
    const r = pickAlternatives(scanned, [store, best], null);
    expect(r.alternatives[0].product.code).toBe("2101");
    expect(r.anyInStore).toBe(false);
  });

  it("prefers products sharing more of the scanned product's categories, then popularity", () => {
    const fewer = product("2201", "Fewer", { categories_tags: ["en:foods"] });
    const more = product("2202", "More", { categories_tags: ["en:foods", "en:spreads", "en:nut-spreads"] });
    const later = product("2203", "Later", { categories_tags: ["en:foods"] });
    const r = pickAlternatives(scanned, [fewer, more, later]);
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["2202", "2201", "2203"]);
  });

  it("removes duplicates by normalised name, including a brand prefix", () => {
    const a = product("3001", "Peanut Butter Smooth", { brands: "Acme" });
    const b = product("3002", "Acme Peanut Butter – smooth", { brands: "Acme" });
    const c = product("3003", "Almond butter");
    const r = pickAlternatives(scanned, [a, b, c]);
    expect(r.alternatives.map((x) => x.product.code)).toEqual(["3001", "3003"]);
  });

  it("drops limited-confidence candidates", () => {
    const limited = product("4001", "No ingredients", { ingredients_text: null, nova_group: null });
    expect(pickAlternatives(scanned, [limited]).alternatives).toEqual([]);
  });

  it("excludes the scanned product itself, including its alternate barcode form", () => {
    const self = product("3017620422003", "Same thing");
    expect(pickAlternatives(scanned, [self]).alternatives).toEqual([]);
    // Scanned as 12-digit UPC-A, listed as the 13-digit EAN form.
    const ean = product("0123456789050", "EAN form");
    expect(pickAlternatives({ ...scanned, barcode: "123456789050" }, [ean]).alternatives).toEqual([]);
    expect(pickAlternatives(scanned, [ean]).alternatives).toHaveLength(1);
  });

  it("returns an empty list when nothing qualifies", () => {
    const r = pickAlternatives({ ...scanned, score: 9 }, [product("5001", "Nine")]);
    expect(r).toEqual({ alternatives: [], anyInStore: false, usedStore: null });
  });

  it("caps the list at 3", () => {
    const list = ["a", "b", "c", "d", "e"].map((n, i) => product(`600${i}`, `Item ${n}`));
    expect(pickAlternatives(scanned, list).alternatives).toHaveLength(3);
  });

  it("uses scoreProduct's beverage thresholds", () => {
    // 9g added sugar: high for a drink (weakest-link cap 5), moderate for a food (8).
    const sugary = { ingredients_text: "water, salt, lemon, sugar", nutriments: { sugars_100g: 9 } as never };
    const drink = product("7001", "Drink", { ...sugary, categories_tags: ["en:beverages"] });
    const food = product("7002", "Food", sugary);
    const r = pickAlternatives(scanned, [drink, food]);
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["7002"]);
    expect(r.alternatives[0].score).toBe(8);
  });

  it("gives the largest positive reason, or low sugar/salt/fat", () => {
    const fibre = product("8001", "Fibre", { nutriments: { fiber_100g: 7 } as never });
    const plain = product("8002", "Plain");
    const r = pickAlternatives(scanned, [fibre, plain]);
    expect(r.alternatives[0].reasonKey).toBe(REASON_KEYS.fibre);
    expect(r.alternatives[1].reasonKey).toBe(REASON_KEYS.lowSugarSaltFat);
  });
});
