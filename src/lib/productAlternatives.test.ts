import { describe, it, expect } from "vitest";
import { pickAlternatives, DISH_CATEGORIES, type AlternativeCandidate } from "./productAlternatives";
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
  categories_tags: ["en:foods", "en:spreads", "en:nut-spreads"],
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
    // One E-number keeps it out of the whole-food floor so the salt cap still shows.
    const five = product("1001", "Five", { ingredients_text: "water, E330", nutriments: { salt_100g: 1.3 } as never });
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

  it("within a tier, prefers products sharing more of the scanned product's categories, then list order", () => {
    // All tier 1 (en:nut-spreads); scores equal.
    const fewer = product("2201", "Fewer", { categories_tags: ["en:nut-spreads"] });
    const more = product("2202", "More", { categories_tags: ["en:foods", "en:spreads", "en:nut-spreads"] });
    const later = product("2203", "Later", { categories_tags: ["en:nut-spreads"] });
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
    expect(r).toEqual({ alternatives: [], anyInStore: false, usedStore: null, relaxed: false });
  });

  it("caps the list at 3", () => {
    const list = ["a", "b", "c", "d", "e"].map((n, i) => product(`600${i}`, `Item ${n}`));
    expect(pickAlternatives(scanned, list).alternatives).toHaveLength(3);
  });

  it("uses scoreProduct's beverage thresholds", () => {
    // 9g added sugar: high for a drink (weakest-link cap 5), moderate for a food (8).
    const sugary = { ingredients_text: "water, salt, lemon, sugar", nutriments: { sugars_100g: 9 } as never };
    const drink = product("7001", "Drink", { ...sugary, categories_tags: ["en:beverages", "en:nut-spreads"] });
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

  describe("like-for-like", () => {
    const mayoTags = ["en:condiments", "en:sauces", "en:dressings", "en:mayonnaises"];
    const mayo = { barcode: "5000000000100", score: 3, categoriesTags: mayoTags };
    // Scores 9 (clean default) unless stated.
    const eggSalad = product("9001", "Egg Salad", {
      categories_tags: ["en:sauces", "en:prepared-salads", "en:salads", "en:egg-salads"],
    });
    const lightMayo = product("9002", "Light Mayonnaise", { categories_tags: mayoTags });

    it("never suggests an egg salad for a mayonnaise, but does suggest a mayonnaise", () => {
      const r = pickAlternatives(mayo, [eggSalad, lightMayo]);
      expect(r.alternatives.map((a) => a.product.code)).toEqual(["9002"]);
    });

    it("uses the second-most specific category only when nothing matches the most specific", () => {
      const dressing = product("9003", "Vinaigrette", { categories_tags: ["en:sauces", "en:dressings"] });
      expect(pickAlternatives(mayo, [dressing, lightMayo]).alternatives.map((a) => a.product.code)).toEqual(["9002"]);
      expect(pickAlternatives(mayo, [dressing]).alternatives.map((a) => a.product.code)).toEqual(["9003"]);
      // Any tier 1 candidate, even one that doesn't qualify, blocks tier 2.
      // (one E-number keeps it out of the whole-food floor)
      const saltyMayo = product("9004", "Salty Mayo", {
        categories_tags: mayoTags,
        ingredients_text: "water, E330",
        nutriments: { salt_100g: 2.25 } as never,
      });
      expect(pickAlternatives(mayo, [saltyMayo, dressing]).alternatives).toEqual([]);
    });

    it("drops prepared dishes unless the scanned product is the same kind of dish", () => {
      const soupTags = ["en:meals", "en:soups", "en:vegetable-soups"];
      const soup = product("9101", "Tomato Soup", { categories_tags: soupTags });
      const mayoSoup = product("9102", "Mayo Dip Soup", { categories_tags: [...mayoTags, "en:soups"] });
      expect(DISH_CATEGORIES).toContain("en:soups");
      expect(pickAlternatives(mayo, [mayoSoup]).alternatives).toEqual([]);
      const scannedSoup = { barcode: "5000000000200", score: 3, categoriesTags: soupTags };
      expect(pickAlternatives(scannedSoup, [soup]).alternatives.map((a) => a.product.code)).toEqual(["9101"]);
    });

    it("drops provisional candidates", () => {
      const noSalt = product("9201", "Mayo, salt unknown", { categories_tags: mayoTags, nutriments: { salt_100g: null } as never });
      expect(pickAlternatives(mayo, [noSalt]).alternatives).toEqual([]);
    });

    it("orders by tier, then store, then score", () => {
      // Tier 2, in store, top score: loses to any qualifying tier 1 product.
      const dressingInStore = product("9301", "Store Dressing", {
        categories_tags: ["en:sauces", "en:dressings"],
        inStore: true,
        nutriments: { fiber_100g: 7 } as never,
      });
      const mayoNine = product("9302", "Mayo Nine", { categories_tags: mayoTags });
      const mayoStore = product("9303", "Mayo Store", {
        categories_tags: mayoTags,
        inStore: true,
        nutriments: { salt_100g: 0.9 } as never,
      });
      const mayoTen = product("9304", "Mayo Ten", { categories_tags: mayoTags, nutriments: { fiber_100g: 7 } as never });
      const r = pickAlternatives(mayo, [dressingInStore, mayoNine, mayoStore, mayoTen], "tesco");
      expect(r.alternatives.map((a) => a.product.code)).toEqual(["9303", "9304", "9302"]);
      expect(r.alternatives.map((a) => a.score)).toEqual([8, 10, 9]);
    });

    it("returns nothing when the scanned product has no usable categories", () => {
      expect(pickAlternatives({ ...mayo, categoriesTags: ["en:foods", "fr:sauces"] }, [lightMayo]).alternatives).toEqual([]);
      expect(pickAlternatives({ ...mayo, categoriesTags: null }, [lightMayo]).alternatives).toEqual([]);
    });
  });
});

describe("pickAlternatives — relaxed pass and tier 2 rules", () => {
  const nutScanned = { barcode: "3017620422003", score: 3, categoriesTags: ["en:foods", "en:spreads", "en:nut-spreads"] };
  const tagged = { categories_tags: ["en:nut-spreads"] };

  it("uses the strict pass (6+) when something qualifies, and is not relaxed", () => {
    const five = product("7001", "Five", { ...tagged, ingredients_text: "water, E330", nutriments: { salt_100g: 1.3 } as never });
    const nine = product("7002", "Nine", tagged);
    const r = pickAlternatives(nutScanned, [five, nine]);
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["7002"]);
    expect(r.relaxed).toBe(false);
  });

  it("falls back to the relaxed pass (5+) only when nothing scores 6+", () => {
    const five = product("7101", "Five", { ...tagged, ingredients_text: "water, E330", nutriments: { salt_100g: 1.3 } as never });
    const r = pickAlternatives(nutScanned, [five]);
    expect(r.alternatives.map((a) => a.score)).toEqual([5]);
    expect(r.relaxed).toBe(true);
  });

  it("the relaxed pass still needs +2 over the scanned product", () => {
    const five = product("7201", "Five", { ...tagged, ingredients_text: "water, E330", nutriments: { salt_100g: 1.3 } as never });
    const r = pickAlternatives({ ...nutScanned, score: 4 }, [five]);
    expect(r.alternatives).toEqual([]);
    expect(r.relaxed).toBe(false);
  });

  it("never uses a BROAD_CATEGORIES tag as tier 2", () => {
    // Scanned: en:spreads (broad) then en:nut-spreads; candidate shares only en:spreads.
    const r = pickAlternatives(nutScanned, [product("7301", "Jam", { categories_tags: ["en:spreads"] })]);
    expect(r.alternatives).toEqual([]);
  });

  it("allows a narrow tier-2 tag when no candidate shares the tier-1 tag", () => {
    const s = { barcode: "5000000000001", score: 3, categoriesTags: ["en:foods", "en:mayonnaises", "en:light-mayonnaises"] };
    const r = pickAlternatives(s, [product("7401", "Mayo", { categories_tags: ["en:mayonnaises"] })]);
    expect(r.alternatives.map((a) => a.product.code)).toEqual(["7401"]);
  });

  it("does not use tier 2 when any candidate has the tier-1 tag, even an unqualified one", () => {
    const s = { barcode: "5000000000001", score: 3, categoriesTags: ["en:foods", "en:mayonnaises", "en:light-mayonnaises"] };
    const weak = product("7501", "Weak light mayo", {
      categories_tags: ["en:light-mayonnaises"],
      ingredients_text: "water, E330",
      nutriments: { salt_100g: 2.25 } as never,
    });
    const r = pickAlternatives(s, [weak, product("7502", "Mayo", { categories_tags: ["en:mayonnaises"] })]);
    expect(r.alternatives).toEqual([]);
  });
});
