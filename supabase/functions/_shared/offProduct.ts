// Shared Open Food Facts product helpers for product-score and product-alternatives.
// Pure TypeScript (no Deno imports) so vitest can test the same file.

export const OFF_USER_AGENT = "CJTNutrition - Nutrition Tracking App - contact@cjtnutrition.com";

export const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "image_url",
  "ingredients_text",
  "ingredients_text_en",
  "ingredients_n",
  "additives_tags",
  "nova_group",
  "nutriscore_grade",
  "categories_tags",
  "stores_tags",
  // The fruit/veg/nuts estimate lives inside nutriments. Asking for it as its own
  // field makes Open Food Facts drop the rest of nutriments, so it is read from there.
  "nutriments",
].join(",");

export interface ProductScoreData {
  found: boolean;
  code: string | null;
  product_name: string | null;
  product_name_en: string | null;
  brands: string | null;
  image_url: string | null;
  ingredients_text: string | null;
  ingredients_text_en: string | null;
  ingredients_n: number | null;
  additives_tags: string[] | null;
  nova_group: number | null;
  nutriscore_grade: string | null;
  categories_tags: string[] | null;
  stores_tags: string[] | null;
  fruits_vegetables_nuts_100g: number | null;
  nutriments: {
    sugars_100g: number | null;
    saturated_fat_100g: number | null;
    salt_100g: number | null;
    fiber_100g: number | null;
    proteins_100g: number | null;
    energy_kcal_100g: number | null;
    fat_100g: number | null;
    carbohydrates_100g: number | null;
  };
}

export const offNum = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
export const offStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
export const offStrArr = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;

/** Raw Open Food Facts product -> clean ProductScoreData (null for anything missing). */
// deno-lint-ignore no-explicit-any
export function toProductScoreData(p: any): ProductScoreData {
  const n = p?.nutriments ?? {};
  return {
    found: true,
    code: offStr(p.code),
    product_name: offStr(p.product_name),
    product_name_en: offStr(p.product_name_en),
    brands: offStr(p.brands),
    image_url: offStr(p.image_url),
    ingredients_text: offStr(p.ingredients_text),
    ingredients_text_en: offStr(p.ingredients_text_en),
    ingredients_n: offNum(p.ingredients_n),
    additives_tags: offStrArr(p.additives_tags),
    nova_group: offNum(p.nova_group),
    nutriscore_grade: offStr(p.nutriscore_grade),
    categories_tags: offStrArr(p.categories_tags),
    stores_tags: offStrArr(p.stores_tags),
    fruits_vegetables_nuts_100g: offNum(
      n["fruits-vegetables-nuts-estimate-from-ingredients_100g"] ??
        p["fruits-vegetables-nuts-estimate-from-ingredients_100g"],
    ),
    nutriments: {
      sugars_100g: offNum(n.sugars_100g),
      saturated_fat_100g: offNum(n["saturated-fat_100g"]),
      salt_100g: offNum(n.salt_100g),
      fiber_100g: offNum(n.fiber_100g),
      proteins_100g: offNum(n.proteins_100g),
      energy_kcal_100g: offNum(n["energy-kcal_100g"]),
      fat_100g: offNum(n.fat_100g),
      carbohydrates_100g: offNum(n.carbohydrates_100g),
    },
  };
}

/** Same alternate-form rule as the meal logger's scanner retry. */
export function alternateBarcode(code: string): string | null {
  if (code.length === 12) return `0${code}`;
  if (code.length === 13 && code.startsWith("0")) return code.slice(1);
  return null;
}
