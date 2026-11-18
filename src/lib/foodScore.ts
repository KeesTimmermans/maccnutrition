/**
 * Scan & rate — product health score (1–10).
 *
 * Pure, network-free scoring of a packaged product from its Open Food Facts
 * data. The score describes the PRODUCT (per-100g values are used only to
 * compare products fairly) and is never shown with grams or calories.
 * Reasons and bands are i18n keys so the UI can translate them.
 */

export interface ProductScoreInput {
  sugars100g?: number | null;
  saturatedFat100g?: number | null;
  salt100g?: number | null;
  fiber100g?: number | null;
  proteins100g?: number | null;
  /** Fruit / vegetables / nuts estimate from ingredients, in % (0–100). */
  fruitVegNuts100g?: number | null;
  ingredientsText?: string | null;
  novaGroup?: number | null;
  additivesTags?: string[] | null;
  categoriesTags?: string[] | null;
}

export type ScoreConfidence = "full" | "limited" | "none";
export type ScoreBand = "good" | "balance" | "occasional";

export interface ProductScoreResult {
  score: number | null;
  band: ScoreBand | null;
  /** i18n keys, max 3, largest impact first. */
  reasons: string[];
  confidence: ScoreConfidence;
}

// ─── Tunable weights ────────────────────────────────────────────────────────

export const BASE_SCORE = 8;
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const MAX_REASONS = 3;

/** Total sugars per 100g: [above this value, penalty]. Checked highest first. */
export const SUGAR_STEPS: Array<[number, number]> = [
  [22.5, -4],
  [15, -3],
  [10, -2],
  [5, -1],
];
/** Drinks use half of every sugar threshold. */
export const BEVERAGE_SUGAR_FACTOR = 0.5;

export const SUGAR_IN_FIRST_INGREDIENTS_PENALTY = -1;
export const FIRST_INGREDIENTS_CHECKED = 3;
export const SUGAR_INGREDIENT_PATTERN =
  /\b(sugars?|glucose|fructose|dextrose|invert sugar|syrups?|honey|maltodextrin)\b/i;

export const SALT_STEPS: Array<[number, number]> = [
  [1.5, -2],
  [0.9, -1],
];

export const SATURATED_FAT_STEPS: Array<[number, number]> = [
  [5, -2],
  [2.5, -1],
];

export const NOVA_PENALTY: Record<number, number> = { 4: -2, 3: -1 };
/** When nova_group is missing: this many additives or more counts as NOVA 4. */
export const NOVA4_ADDITIVE_COUNT = 3;

export const SWEETENER_CODES = new Set([950, 951, 952, 954, 955, 957, 959, 960, 961, 962, 969]);
export const SWEETENER_PENALTY = -1;

export const MANY_ADDITIVES_COUNT = 3;
export const MANY_ADDITIVES_PENALTY = -1;

/** Fibre per 100g: [at least this value, bonus]. Checked highest first. */
export const FIBRE_STEPS: Array<[number, number]> = [
  [6, 2],
  [3, 1],
];

export const PROTEIN_STEPS: Array<[number, number]> = [[8, 1]];

/** Fruit/veg/nuts estimate (%): [at least this value, bonus]. */
export const WHOLE_INGREDIENT_STEPS: Array<[number, number]> = [
  [80, 2],
  [40, 1],
];

export const GOOD_BAND_MIN = 7;
export const BALANCE_BAND_MIN = 4;

// ─── Reason keys (fixed phrases, translated in the UI) ──────────────────────

export const REASON_KEYS = {
  highSugar: "score_reason_high_sugar",
  someSugar: "score_reason_some_sugar",
  sugarFirst: "score_reason_sugar_first",
  highSalt: "score_reason_high_salt",
  someSalt: "score_reason_some_salt",
  highSatFat: "score_reason_high_sat_fat",
  someSatFat: "score_reason_some_sat_fat",
  ultraProcessed: "score_reason_ultra_processed",
  processed: "score_reason_processed",
  sweeteners: "score_reason_sweeteners",
  additives: "score_reason_additives",
  fibre: "score_reason_fibre",
  protein: "score_reason_protein",
  wholeIngredients: "score_reason_whole",
  lowSugarSaltFat: "score_reason_low_sugar_salt_fat",
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Penalty for the first step whose threshold the value is strictly above. */
function penaltyAbove(value: number, steps: Array<[number, number]>, factor = 1): number {
  for (const [threshold, impact] of steps) {
    if (value > threshold * factor) return impact;
  }
  return 0;
}

/** Bonus for the first step whose threshold the value reaches. */
function bonusAtLeast(value: number, steps: Array<[number, number]>): number {
  for (const [threshold, impact] of steps) {
    if (value >= threshold) return impact;
  }
  return 0;
}

export function isBeverage(categoriesTags?: string[] | null): boolean {
  return (categoriesTags ?? []).some((tag) => {
    const name = tag.toLowerCase().split(":").pop() ?? "";
    return name === "beverages";
  });
}

/** First N top-level ingredients, with bracketed sub-ingredients removed. */
export function firstIngredients(text: string, n = FIRST_INGREDIENTS_CHECKED): string[] {
  let depth = 0;
  let flat = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0) flat += ch;
  }
  return flat
    .split(/[,;]/)
    .map((s) => s.replace(/[_*]/g, "").trim())
    .filter(Boolean)
    .slice(0, n);
}

export function hasSugarInFirstIngredients(text: string): boolean {
  return firstIngredients(text).some((ing) => SUGAR_INGREDIENT_PATTERN.test(ing));
}

export function hasArtificialSweetener(additivesTags?: string[] | null): boolean {
  return (additivesTags ?? []).some((tag) => {
    const code = (tag.toLowerCase().split(":").pop() ?? "").trim();
    const match = code.match(/^e(\d+)/);
    return !!match && SWEETENER_CODES.has(Number(match[1]));
  });
}

export function bandForScore(score: number): ScoreBand {
  if (score >= GOOD_BAND_MIN) return "good";
  if (score >= BALANCE_BAND_MIN) return "balance";
  return "occasional";
}

// ─── Main ───────────────────────────────────────────────────────────────────

interface Factor {
  impact: number;
  reason: string;
}

export function scoreProduct(input: ProductScoreInput): ProductScoreResult {
  const ingredientsText = input.ingredientsText?.trim() || null;
  const hasSugars = isNum(input.sugars100g);
  const hasNova = isNum(input.novaGroup);
  const hasIngredientInfo = !!ingredientsText || hasNova;

  if (!hasSugars && !hasIngredientInfo) {
    return { score: null, band: null, reasons: [], confidence: "none" };
  }
  const confidence: ScoreConfidence = hasSugars && hasIngredientInfo ? "full" : "limited";

  const factors: Factor[] = [];
  const add = (impact: number, reason: string) => {
    if (impact !== 0) factors.push({ impact, reason });
  };

  // Sugar
  if (hasSugars) {
    const factor = isBeverage(input.categoriesTags) ? BEVERAGE_SUGAR_FACTOR : 1;
    const impact = penaltyAbove(input.sugars100g as number, SUGAR_STEPS, factor);
    add(impact, impact <= -3 ? REASON_KEYS.highSugar : REASON_KEYS.someSugar);
  }

  // Salt
  if (isNum(input.salt100g)) {
    const impact = penaltyAbove(input.salt100g, SALT_STEPS);
    add(impact, impact <= -2 ? REASON_KEYS.highSalt : REASON_KEYS.someSalt);
  }

  // Saturated fat
  if (isNum(input.saturatedFat100g)) {
    const impact = penaltyAbove(input.saturatedFat100g, SATURATED_FAT_STEPS);
    add(impact, impact <= -2 ? REASON_KEYS.highSatFat : REASON_KEYS.someSatFat);
  }

  // Ingredient-based rules only run when ingredient info exists.
  if (hasIngredientInfo) {
    if (ingredientsText && hasSugarInFirstIngredients(ingredientsText)) {
      add(SUGAR_IN_FIRST_INGREDIENTS_PENALTY, REASON_KEYS.sugarFirst);
    }

    const additiveCount = (input.additivesTags ?? []).length;
    let nova = hasNova ? (input.novaGroup as number) : null;
    if (nova === null) {
      if (additiveCount >= NOVA4_ADDITIVE_COUNT) nova = 4;
      else if (additiveCount >= 1) nova = 3;
    }
    if (nova !== null) {
      const impact = NOVA_PENALTY[nova] ?? 0;
      add(impact, nova === 4 ? REASON_KEYS.ultraProcessed : REASON_KEYS.processed);
    }

    if (hasArtificialSweetener(input.additivesTags)) {
      add(SWEETENER_PENALTY, REASON_KEYS.sweeteners);
    }
    if (additiveCount >= MANY_ADDITIVES_COUNT) {
      add(MANY_ADDITIVES_PENALTY, REASON_KEYS.additives);
    }
  }

  // Positives
  if (isNum(input.fiber100g)) add(bonusAtLeast(input.fiber100g, FIBRE_STEPS), REASON_KEYS.fibre);
  if (isNum(input.proteins100g)) add(bonusAtLeast(input.proteins100g, PROTEIN_STEPS), REASON_KEYS.protein);
  if (isNum(input.fruitVegNuts100g)) {
    add(bonusAtLeast(input.fruitVegNuts100g, WHOLE_INGREDIENT_STEPS), REASON_KEYS.wholeIngredients);
  }

  const raw = BASE_SCORE + factors.reduce((sum, f) => sum + f.impact, 0);
  const score = Math.round(Math.min(MAX_SCORE, Math.max(MIN_SCORE, raw)));

  // Largest absolute impact first; ties keep rule order (stable sort).
  const reasons = [...factors]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, MAX_REASONS)
    .map((f) => f.reason);

  // A product with nothing to flag still gets one honest reason.
  if (
    reasons.length === 0 &&
    hasSugars &&
    isNum(input.salt100g) &&
    isNum(input.saturatedFat100g)
  ) {
    reasons.push(REASON_KEYS.lowSugarSaltFat);
  }

  return { score, band: bandForScore(score), reasons, confidence };
}
