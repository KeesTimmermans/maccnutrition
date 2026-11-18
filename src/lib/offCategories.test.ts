import { describe, it, expect } from "vitest";
import { categoriesToTry, isInStore } from "../../supabase/functions/_shared/offCategories.ts";

describe("categoriesToTry", () => {
  it("returns the 3 most specific English tags, most specific first, skipping generic ones", () => {
    expect(
      categoriesToTry([
        "en:beverages-and-beverages-preparations",
        "en:beverages",
        "en:non-alcoholic-beverages",
        "en:soft-drinks",
        "en:carbonated-drinks",
        "en:sodas",
        "en:colas",
        "pt:bebidas cafeína",
      ]),
    ).toEqual(["en:colas", "en:sodas", "en:carbonated-drinks"]);
    expect(categoriesToTry(["en:snacks", "en:sweet-snacks", "en:foods"])).toEqual([]);
    expect(categoriesToTry(null)).toEqual([]);
  });
});

describe("isInStore", () => {
  it("recognises store tags and display names", () => {
    expect(isInStore(["Sainsbury's"], "sainsburys")).toBe(true);
    expect(isInStore(["sainsbury-s"], "sainsburys")).toBe(true);
    expect(isInStore(["Marks & Spencer"], "marks_and_spencer")).toBe(true);
    expect(isInStore(["M&S"], "marks_and_spencer")).toBe(true);
    expect(isInStore(["Co-op"], "coop")).toBe(true);
    expect(isInStore(["Tesco Express"], "tesco")).toBe(true);
  });
  it("never matches on unrelated names, other stores or no store", () => {
    expect(isInStore(["Farm Shop"], "marks_and_spencer")).toBe(false);
    expect(isInStore(["carrefour", "mercadona"], "tesco")).toBe(false);
    expect(isInStore(["tesco"], null)).toBe(false);
    expect(isInStore(null, "tesco")).toBe(false);
  });
});
