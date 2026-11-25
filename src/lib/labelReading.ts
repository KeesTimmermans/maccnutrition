import type { ProductScoreInput } from "./foodScore";

/** Raw values the read-label function returns from a photo of a nutrition label. */
export interface LabelReading {
  productName: string | null;
  per100gOrPerServing: "per100g" | "perServing" | null;
  servingSizeG: number | null;
  sugarsG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
  sodiumG: number | null;
  fibreG: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  energyKcal: number | null;
  ingredientsText: string | null;
}

export const SODIUM_TO_SALT = 2.5;

export const LABEL_NUMBER_FIELDS = [
  "sugarsG", "saturatedFatG", "saltG", "fibreG", "proteinG", "fatG", "carbsG", "energyKcal",
] as const;
export type LabelNumberField = (typeof LABEL_NUMBER_FIELDS)[number];

/** Per-100g values ready for the review form (sodium already folded into salt). */
export type LabelValues = Record<LabelNumberField, number | null> & {
  productName: string | null;
  ingredientsText: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Salt from the label, else sodium × 2.5. */
export function saltFromReading(saltG: unknown, sodiumG: unknown): number | null {
  const salt = num(saltG);
  if (salt !== null) return salt;
  const sodium = num(sodiumG);
  return sodium === null ? null : round(sodium * SODIUM_TO_SALT);
}

/** Convert a reading to per-100g values. Per-serving values without a serving size become null. */
export function toPer100g(r: Partial<LabelReading>): LabelValues {
  const perServing = r.per100gOrPerServing === "perServing";
  const serving = num(r.servingSizeG);
  const factor = perServing ? (serving && serving > 0 ? 100 / serving : null) : 1;
  const conv = (v: unknown): number | null => {
    const n = num(v);
    if (n === null || factor === null) return null;
    return round(n * factor);
  };
  const salt = saltFromReading(r.saltG, r.sodiumG);
  return {
    productName: r.productName?.trim() || null,
    ingredientsText: r.ingredientsText?.trim() || null,
    sugarsG: conv(r.sugarsG),
    saturatedFatG: conv(r.saturatedFatG),
    saltG: salt === null || factor === null ? null : round(salt * factor),
    fibreG: conv(r.fibreG),
    proteinG: conv(r.proteinG),
    fatG: conv(r.fatG),
    carbsG: conv(r.carbsG),
    energyKcal: conv(r.energyKcal),
  };
}

/** How many score-relevant fields have a value. */
export function countFilled(v: LabelValues): number {
  return LABEL_NUMBER_FIELDS.filter((k) => v[k] !== null).length + (v.ingredientsText ? 1 : 0);
}

/** Build the scoring input. No categories and no NOVA: a photo can't tell us those. */
export function labelToScoreInput(v: LabelValues): ProductScoreInput {
  return {
    sugars100g: v.sugarsG,
    saturatedFat100g: v.saturatedFatG,
    salt100g: v.saltG,
    fiber100g: v.fibreG,
    proteins100g: v.proteinG,
    energyKcal100g: v.energyKcal,
    fat100g: v.fatG,
    carbohydrates100g: v.carbsG,
    fruitVegNuts100g: null,
    ingredientsText: v.ingredientsText,
    ingredientsN: null,
    novaGroup: null,
    additivesTags: null,
    categoriesTags: null,
  };
}
