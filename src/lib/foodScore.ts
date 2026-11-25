/**
 * Scan & rate — product health score (1–10), 5-pillar model.
 *
 * Pure, network-free scoring of a packaged product from its Open Food Facts
 * data. Each pillar (sugar, salt, saturated fat, processing, protein & fibre) is
 * scored 1–10, combined into a weighted average, then capped so one weak area or
 * missing data can't be hidden by "fine by default" areas.
 *
 * The score describes the PRODUCT (per-100g values are used only to compare
 * products fairly) and is never shown with grams or calories. Reasons, pillar
 * labels and notes are i18n keys. The result screen and the "How scores work"
 * guide are both generated from the constants below, so they can't disagree.
 */

export interface ProductScoreInput {
  sugars100g?: number | null;
  saturatedFat100g?: number | null;
  salt100g?: number | null;
  fiber100g?: number | null;
  proteins100g?: number | null;
  /** Only used to spot implausible label data, never scored. */
  energyKcal100g?: number | null;
  fat100g?: number | null;
  carbohydrates100g?: number | null;
  /** Fruit / vegetables / nuts estimate from ingredients, in % (0–100). */
  fruitVegNuts100g?: number | null;
  ingredientsText?: string | null;
  /** Number of ingredients as counted by Open Food Facts. */
  ingredientsN?: number | null;
  novaGroup?: number | null;
  additivesTags?: string[] | null;
  categoriesTags?: string[] | null;
}

export type ScoreConfidence = "full" | "limited" | "none";
export type ScoreBand = "good" | "balance" | "occasional";
export type PillarId = "sugar" | "salt" | "satFat" | "processing" | "proteinFibre";
export type CapId = "weakest_link" | "sweeteners" | "provisional" | "grain_staple";
export type FloorKind = "whole_food" | "animal_food" | "dark_chocolate";

export interface PillarResult {
  id: PillarId;
  labelKey: string;
  weight: number;
  /** False for protein & fibre on drinks: skipped in the average. */
  applicable: boolean;
  /** False when every input was missing (pillar then counts as 5). */
  known: boolean;
  /** Unrounded pillar score, 1 decimal. */
  raw: number;
  /** Whole-number score 1–10 for display. */
  score: number;
  /** i18n keys explaining adjustments (no numbers). */
  noteKeys: string[];
}

export interface CapResult {
  id: CapId;
  limit: number;
  /** True only when this cap is what lowered the final score. */
  applied: boolean;
}

export interface ProductScoreResult {
  score: number | null;
  band: ScoreBand | null;
  /** i18n keys, max 3, worst first. */
  reasons: string[];
  confidence: ScoreConfidence;
  /** True when some data was missing (limited confidence or an unknown pillar). */
  provisional: boolean;
  /** Weighted average of the applicable pillars, 1 decimal (null when unscored). */
  average: number | null;
  pillars: PillarResult[];
  /** Caps whose condition was met; `applied` marks the ones that lowered the score. */
  caps: CapResult[];
  /** True when the product counts as a whole food (see WHOLE_FOOD_CATEGORIES). */
  wholeFood: boolean;
  /**
   * Highest floor whose condition was met (whole food, basic meat/fish/dairy or
   * high-cocoa dark chocolate); `applied` is true only when it raised the final score.
   * With no floor met, `limit` is WHOLE_FOOD_FLOOR and `applied` is false.
   */
  floor: { limit: number; applied: boolean };
  /** Which floor `floor` reports, or null when no floor condition was met. */
  floorKind: FloorKind | null;
}

/** [value, score] points; scores between points are interpolated linearly. */
export type Anchors = ReadonlyArray<readonly [number, number]>;

// ─── Score range and bands ──────────────────────────────────────────────────

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const MAX_REASONS = 3;
export const GOOD_BAND_MIN = 7;
export const BALANCE_BAND_MIN = 4;
/** Score a pillar gets when all of its inputs are missing. */
export const UNKNOWN_PILLAR_SCORE = 5;

// ─── Pillar 1: sugar (total sugars per 100g / 100ml) ────────────────────────

export const SUGAR_WEIGHT = 2;
export const SUGAR_ANCHORS_FOOD: Anchors = [
  [1, 10],
  [5, 8],
  [10, 6],
  [15, 4],
  [22.5, 1],
];
/** Drinks use half of every sugar value in the food table. */
export const BEVERAGE_SUGAR_FACTOR = 0.5;
export const SUGAR_ANCHORS_DRINK: Anchors = SUGAR_ANCHORS_FOOD.map(
  ([x, s]) => [x * BEVERAGE_SUGAR_FACTOR, s] as const,
);
/** With an ingredient list and no sugar-type ingredient, sugars are natural: count half. */
export const NATURAL_SUGAR_FACTOR = 0.5;
export const SUGAR_IN_FIRST_INGREDIENTS_PENALTY = -1;
export const FIRST_INGREDIENTS_CHECKED = 3;
export const SUGAR_INGREDIENT_PATTERN =
  /\b(sugars?|glucose|fructose|dextrose|invert sugar|syrups?|honey|maltodextrin)\b/i;
/** Sugars in juice and smoothies are free sugars: never halved as natural sugar. */
export const FULL_SUGAR_CATEGORIES = ["en:fruit-juices", "en:smoothies"];

// ─── Pillar 2: salt (g per 100g) ────────────────────────────────────────────

export const SALT_WEIGHT = 1;
export const SALT_ANCHORS: Anchors = [
  [0.1, 10],
  [0.3, 9],
  [0.6, 7],
  [0.9, 5],
  [1.5, 2],
  [2.25, 1],
];

// ─── Pillar 3: saturated fat (g per 100g) ───────────────────────────────────

export const SAT_FAT_WEIGHT = 1;
export const SAT_FAT_ANCHORS: Anchors = [
  [0.5, 10],
  [1.5, 8],
  [2.5, 6],
  [5, 3],
  [10, 1],
];

export interface SatFatException {
  id: string;
  categories: string[];
  /** Pillar is set to this score. */
  fixed?: number;
  /** Pillar is at least this score. */
  floor?: number;
  /** Only when no sugar-type ingredient is listed (plain products). */
  plainOnly?: boolean;
  /**
   * Also matches, without the categories, when the fruit/veg/nuts estimate is at
   * least this (in %) with no sugar-type ingredient and no additives.
   */
  nutsMin?: number;
  noteKey: string;
}

/** Category-based exceptions; the first matching one is used. Add rows to extend. */
export const SAT_FAT_EXCEPTIONS: SatFatException[] = [
  {
    id: "nuts_seeds_oils",
    categories: [
      "en:nuts",
      "en:seeds",
      "en:nuts-and-their-products",
      "en:vegetable-oils",
      "en:olive-oils",
      "en:vegetable-fats",
    ],
    fixed: 7,
    noteKey: "pillar_note_nuts_oils",
  },
  {
    // A floor, not a fixed value: a lower-fat nut butter keeps its higher score.
    id: "nut_seed_butters",
    categories: ["en:nut-butters", "en:peanut-butters", "en:tahini", "en:seed-butters"],
    floor: 7,
    nutsMin: 60,
    noteKey: "pillar_note_nuts_oils",
  },
  {
    id: "plain_milk_yoghurt",
    categories: ["en:milks", "en:yogurts"],
    floor: 5,
    plainOnly: true,
    noteKey: "pillar_note_plain_dairy",
  },
];

// ─── Pillar 4: processing ───────────────────────────────────────────────────

export const PROCESSING_WEIGHT = 2;
export const NOVA_BASE: Record<number, number> = { 1: 10, 2: 8, 3: 6, 4: 3 };
/** Without a NOVA group: any of these in the ingredients means ultra-processed (4). */
export const ULTRA_PROCESSED_MARKERS =
  /\b(flavou?rings?|emulsifiers?|modified\s+\w*\s*starch|modified starch|hydrogenated|colou?rs?)\b/i;
/** Without a NOVA group: this many additives or more means 4, fewer (but ≥1) means 3. */
export const NOVA4_ADDITIVE_COUNT = 3;
export const SWEETENER_PENALTY = -1;
/** [at least this many additives, penalty], checked highest first. */
export const ADDITIVE_STEPS: Array<[number, number]> = [
  [6, -2],
  [3, -1],
];
export const MANY_ADDITIVES_COUNT = 3;
export const SHORT_INGREDIENT_LIST = 5;
export const SHORT_LIST_BONUS = 1;
export const LONG_INGREDIENT_LIST = 16;
export const LONG_LIST_PENALTY = -1;
export const E_NUMBER_PATTERN = /\bE\s?\d{3,4}[a-i]?\b/gi;

export const SWEETENER_CODES = new Set([
  950, 951, 952, 954, 955, 957, 959, 960, 961, 962, 963, 964, 965, 966, 967, 968, 969,
]);
export const SWEETENER_NAME_PATTERN =
  /\b(aspartame|acesulfame|sucralose|saccharin|cyclamates?|neotame|steviol glycosides?|sweeteners?)\b/i;

// ─── Pillar 5: protein & fibre (foods only) ─────────────────────────────────

export const PROTEIN_FIBRE_WEIGHT = 1;
export const PROTEIN_ANCHORS: Anchors = [
  [0, 4],
  [3, 5.5],
  [6, 7],
  [10, 8.5],
  [20, 10],
];
export const FIBRE_ANCHORS: Anchors = [
  [0, 4],
  [2, 5.5],
  [3, 6.5],
  [6, 9],
  [9, 10],
];
/** Fruit / vegetables / nuts estimate in %. */
export const WHOLE_INGREDIENT_ANCHORS: Anchors = [
  [0, 4],
  [20, 5],
  [40, 7],
  [60, 8.5],
  [80, 10],
];
/** Protein & fibre at or above this earns a positive reason chip. */
export const POSITIVE_PILLAR_MIN = 8;

// ─── Caps ───────────────────────────────────────────────────────────────────

/** A limit pillar at or below this caps the final score at that pillar + margin. */
export const WEAKEST_LINK_THRESHOLD = 3;
export const WEAKEST_LINK_MARGIN = 2;
export const SWEETENER_CAP = 6;
export const PROVISIONAL_CAP = 7;
/** Pillars that can trigger the weakest-link cap (protein & fibre never does). */
export const LIMIT_PILLARS: PillarId[] = ["sugar", "salt", "satFat", "processing"];

// ─── Whole-food floor (applied after the caps; pillars and average unchanged) ─

/** Whole foods never score below this overall. */
export const WHOLE_FOOD_FLOOR = 7;
/** NOVA groups a whole food may have (the effective group, given or inferred). */
export const WHOLE_FOOD_NOVA_GROUPS = [1, 2, 3];
/** NOVA 2–3 products count as whole foods only in these categories… */
export const WHOLE_FOOD_CATEGORIES = [
  "en:cheeses",
  "en:eggs",
  "en:meats",
  "en:fresh-meats",
  "en:fishes",
  "en:seafood",
  "en:milks",
  "en:yogurts",
  "en:avocados",
  "en:coconuts",
  "en:honeys",
];
/**
 * Single-ingredient products here may name a sugar-type word (honey) and still be whole foods,
 * as long as nothing else sugar-like is listed once "honey" is removed.
 */
export const WHOLE_FOOD_SUGAR_EXEMPT_CATEGORIES = ["en:honeys"];
/** …and with at most this many ingredients. */
export const WHOLE_FOOD_MAX_INGREDIENTS = 5;
/** Never whole foods, whatever else holds. */
export const WHOLE_FOOD_EXCLUDED = [
  "en:butters",
  "en:creams",
  "en:processed-cheeses",
  "en:sausages",
  "en:bacon",
  "en:cured-meats",
  "en:charcuteries",
];

// ─── Basic meat, fish and dairy floor (after the caps, like the whole-food floor) ─

/** Basic meat, fish and dairy foods that aren't sweet never score below this. */
export const ANIMAL_FLOOR = 6;
export const ANIMAL_FOOD_CATEGORIES = [
  "en:meats",
  "en:fishes",
  "en:seafood",
  "en:dairies",
  "en:butters",
  "en:cheeses",
  "en:sausages",
  "en:hams",
  "en:bacon",
  "en:eggs",
];
/** The sugar pillar must score at least this (sweetened yoghurts and desserts don't qualify). */
export const ANIMAL_FLOOR_MIN_SUGAR_PILLAR = 8;
export const ANIMAL_FOOD_EXCLUDED = ["en:processed-cheeses"];
/** Ready-made dishes never get the animal floor. */
export const DISH_CATEGORIES_FOR_FLOOR = [
  "en:salads",
  "en:prepared-salads",
  "en:meals",
  "en:ready-meals",
  "en:sandwiches",
  "en:sandwich-fillings",
  "en:meal-kits",
  "en:soups",
  "en:pizzas-pies-and-quiches",
];

// ─── High-cocoa dark chocolate (sat-fat pillar floor + final floor) ─────────

export const DARK_CHOCOLATE_CATEGORY = "en:dark-chocolates";
/** The first top-level ingredient (percentages removed) must be one of these. */
export const DARK_CHOCOLATE_FIRST_INGREDIENT = /^(cocoa mass|cocoa paste|cocoa)$/i;
export const DARK_CHOCOLATE_MAX_SUGAR = 30;
/** Cocoa fat: the saturated-fat pillar is at least this. */
export const DARK_CHOCOLATE_SAT_FAT_FLOOR = 7;
export const DARK_CHOCOLATE_FLOOR = 6;

// ─── Grain staple cap (applied last, so it wins over every floor) ───────────

export const GRAIN_STAPLE_CATEGORIES = [
  "en:rices",
  "en:white-rices",
  "en:brown-rices",
  "en:basmati-rices",
  "en:pastas",
  "en:wholewheat-pastas",
  "en:oat-flakes",
  "en:rolled-oats",
  "en:oats",
  "en:couscous",
];
/** Fibre (g/100g) below this, or unknown, counts as a refined grain. */
export const GRAIN_FIBRE_THRESHOLD = 3;
export const GRAIN_CAP_REFINED = 6;
export const GRAIN_CAP_WHOLE = 8;

// ─── Pillar definitions (shared by the result screen and the guide) ─────────

export interface PillarDefinition {
  id: PillarId;
  labelKey: string;
  descriptionKey: string;
  weight: number;
  foodsOnly: boolean;
}

export const PILLARS: PillarDefinition[] = [
  { id: "sugar", labelKey: "pillar_sugar", descriptionKey: "pillar_desc_sugar", weight: SUGAR_WEIGHT, foodsOnly: false },
  { id: "salt", labelKey: "pillar_salt", descriptionKey: "pillar_desc_salt", weight: SALT_WEIGHT, foodsOnly: false },
  { id: "satFat", labelKey: "pillar_sat_fat", descriptionKey: "pillar_desc_sat_fat", weight: SAT_FAT_WEIGHT, foodsOnly: false },
  {
    id: "processing",
    labelKey: "pillar_processing",
    descriptionKey: "pillar_desc_processing",
    weight: PROCESSING_WEIGHT,
    foodsOnly: false,
  },
  {
    id: "proteinFibre",
    labelKey: "pillar_protein_fibre",
    descriptionKey: "pillar_desc_protein_fibre",
    weight: PROTEIN_FIBRE_WEIGHT,
    foodsOnly: true,
  },
];

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
  dataLooksOff: "score_reason_data_looks_off",
} as const;

// ─── Implausible label data ─────────────────────────────────────────────────

/** Any per-100g gram value above this (or below 0) is impossible. */
export const IMPLAUSIBLE_MAX_GRAMS = 100;
export const IMPLAUSIBLE_MAX_KCAL = 900;
/** fat + carbs + protein + fibre + salt per 100g may not exceed this. */
export const IMPLAUSIBLE_MAX_SUM = 105;
/** Sugars may exceed carbs (and sat fat may exceed fat) by at most this. */
export const IMPLAUSIBLE_PART_MARGIN = 1;

/** True when the label numbers can't all be right. Null values are ignored. */
export function nutritionLooksImplausible(n: ProductScoreInput | null | undefined): boolean {
  if (!n) return false;
  const v = (x: number | null | undefined): number | null => (isNum(x) ? x : null);
  const grams = [n.sugars100g, n.saturatedFat100g, n.salt100g, n.fiber100g, n.proteins100g, n.fat100g, n.carbohydrates100g].map(v);
  if (grams.some((g) => g !== null && (g < 0 || g > IMPLAUSIBLE_MAX_GRAMS))) return true;
  const kcal = v(n.energyKcal100g);
  if (kcal !== null && (kcal < 0 || kcal > IMPLAUSIBLE_MAX_KCAL)) return true;
  const sum = [n.fat100g, n.carbohydrates100g, n.proteins100g, n.fiber100g, n.salt100g]
    .map(v)
    .reduce<number>((s, g) => s + (g ?? 0), 0);
  if (sum > IMPLAUSIBLE_MAX_SUM) return true;
  const sugars = v(n.sugars100g), carbs = v(n.carbohydrates100g);
  if (sugars !== null && carbs !== null && sugars > carbs + IMPLAUSIBLE_PART_MARGIN) return true;
  const sat = v(n.saturatedFat100g), fat = v(n.fat100g);
  if (sat !== null && fat !== null && sat > fat + IMPLAUSIBLE_PART_MARGIN) return true;
  return false;
}

export const PILLAR_NOTE_KEYS = {
  naturalSugar: "pillar_note_natural_sugar",
  sugarFirst: REASON_KEYS.sugarFirst,
  novaInferred: "pillar_note_nova_inferred",
  sweeteners: REASON_KEYS.sweeteners,
  additives: REASON_KEYS.additives,
  shortList: "pillar_note_short_list",
  longList: "pillar_note_long_list",
  juiceSugar: "pillar_note_juice_sugar",
  cocoaFat: "pillar_note_cocoa_fat",
} as const;

/** i18n keys for the cap lines on the result screen; {limit} / {threshold} are filled in. */
export const CAP_LINE_KEYS: Record<CapId, string> = {
  weakest_link: "score_cap_weakest",
  sweeteners: "score_cap_sweeteners",
  provisional: "score_cap_provisional",
  grain_staple: "score_cap_grain_whole",
};
export const GRAIN_CAP_REFINED_LINE_KEY = "score_cap_grain_refined";
/** i18n key for a cap's result-screen line (the grain cap has a refined and a whole-grain line). */
export function capLineKey(cap: Pick<CapResult, "id" | "limit">): string {
  if (cap.id === "grain_staple" && cap.limit === GRAIN_CAP_REFINED) return GRAIN_CAP_REFINED_LINE_KEY;
  return CAP_LINE_KEYS[cap.id];
}
/** Result-screen line when the whole-food floor raised the score; {limit} is filled in. */
export const FLOOR_LINE_KEY = "score_floor_whole_food";
/** Result-screen line per floor kind; {limit} is filled in. */
export const FLOOR_LINE_KEYS: Record<FloorKind, string> = {
  whole_food: FLOOR_LINE_KEY,
  animal_food: "score_floor_animal",
  dark_chocolate: "score_floor_dark_chocolate",
};

// ─── "How scores work" guide, generated from the constants above ────────────

export const SCORING_GUIDE = {
  pillars: PILLARS.map((p) => ({ ...p, countsDouble: p.weight > 1 })),
  drinksKey: "scoring_guide_drinks",
  juiceKey: "scoring_guide_juice",
  caps: [
    {
      id: "weakest_link" as CapId,
      textKey: "scoring_guide_cap_weakest",
      values: { threshold: WEAKEST_LINK_THRESHOLD, margin: WEAKEST_LINK_MARGIN },
    },
    { id: "sweeteners" as CapId, textKey: "scoring_guide_cap_sweeteners", values: { limit: SWEETENER_CAP } },
    { id: "provisional" as CapId, textKey: "scoring_guide_cap_provisional", values: { limit: PROVISIONAL_CAP } },
    {
      id: "grain_staple" as CapId,
      textKey: "scoring_guide_cap_grain",
      values: { whole: GRAIN_CAP_WHOLE, refined: GRAIN_CAP_REFINED },
    },
  ],
  wholeFood: { textKey: "scoring_guide_note_whole_food", values: { limit: WHOLE_FOOD_FLOOR } },
  floors: [
    { kind: "whole_food" as FloorKind, textKey: "scoring_guide_note_whole_food", values: { limit: WHOLE_FOOD_FLOOR } },
    { kind: "animal_food" as FloorKind, textKey: "scoring_guide_note_animal", values: { limit: ANIMAL_FLOOR } },
    {
      kind: "dark_chocolate" as FloorKind,
      textKey: "scoring_guide_note_dark_chocolate",
      values: { limit: DARK_CHOCOLATE_FLOOR },
    },
  ],
  bands: [
    { band: "good" as ScoreBand, min: GOOD_BAND_MIN, max: MAX_SCORE, key: "score_band_good" },
    { band: "balance" as ScoreBand, min: BALANCE_BAND_MIN, max: GOOD_BAND_MIN - 1, key: "score_band_balance" },
    { band: "occasional" as ScoreBand, min: MIN_SCORE, max: BALANCE_BAND_MIN - 1, key: "score_band_occasional" },
  ],
  noteKeys: [
    "scoring_guide_note_product",
    "scoring_guide_note_natural",
    "scoring_guide_note_data",
    "scoring_guide_note_medical",
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, min = MIN_SCORE, max = MAX_SCORE) => Math.min(max, Math.max(min, v));
const oneDecimal = (v: number) => Math.round(v * 10) / 10;
/** Round half up (6.5 → 7). */
const roundHalfUp = (v: number) => Math.floor(v + 0.5);

/** Piecewise-linear between anchor points, clamped to the end scores outside the range. */
export function interpolate(value: number, anchors: Anchors): number {
  if (anchors.length === 0) return UNKNOWN_PILLAR_SCORE;
  const [firstX, firstS] = anchors[0];
  if (value <= firstX) return firstS;
  for (let i = 1; i < anchors.length; i++) {
    const [x1, s1] = anchors[i];
    if (value <= x1) {
      const [x0, s0] = anchors[i - 1];
      return s0 + ((value - x0) / (x1 - x0)) * (s1 - s0);
    }
  }
  return anchors[anchors.length - 1][1];
}

export function isBeverage(categoriesTags?: string[] | null): boolean {
  return (categoriesTags ?? []).some((tag) => {
    const name = tag.toLowerCase().split(":").pop() ?? "";
    return name === "beverages";
  });
}

/** Ingredient text with bracketed sub-ingredients removed. */
function topLevelText(text: string): string {
  let depth = 0;
  let flat = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0) flat += ch;
  }
  return flat;
}

function topLevelIngredients(text: string): string[] {
  return topLevelText(text)
    .split(/[,;]/)
    .map((s) => s.replace(/[_*.]/g, "").trim())
    .filter(Boolean);
}

/** First N top-level ingredients, with bracketed sub-ingredients removed. */
export function firstIngredients(text: string, n = FIRST_INGREDIENTS_CHECKED): string[] {
  return topLevelIngredients(text).slice(0, n);
}

export function hasSugarInFirstIngredients(text: string): boolean {
  return firstIngredients(text).some((ing) => SUGAR_INGREDIENT_PATTERN.test(ing));
}

/** True when the first top-level ingredient is cocoa mass, cocoa paste or cocoa. */
export function startsWithCocoa(text: string): boolean {
  const first = firstIngredients(text, 1)[0];
  if (!first) return false;
  const name = first.replace(/\d+(?:[.,]\d+)?\s*%/g, "").replace(/\s+/g, " ").trim();
  return DARK_CHOCOLATE_FIRST_INGREDIENT.test(name);
}

const eCodeNumber = (code: string): number | null => {
  const m = code.toLowerCase().replace(/\s/g, "").match(/^(?:en:)?e(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Unique E-numbers written in the ingredient text. */
export function eNumbersInText(text: string): string[] {
  const found = text.match(E_NUMBER_PATTERN) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase().replace(/\s/g, "")))];
}

/** Sweeteners from additive tags; from the ingredient text only when tags are missing. */
export function hasArtificialSweetener(additivesTags?: string[] | null, ingredientsText?: string | null): boolean {
  const tags = additivesTags ?? [];
  if (tags.length > 0) {
    return tags.some((tag) => {
      const n = eCodeNumber(tag.split(":").pop() ?? "");
      return n !== null && SWEETENER_CODES.has(n);
    });
  }
  if (!ingredientsText) return false;
  if (SWEETENER_NAME_PATTERN.test(ingredientsText)) return true;
  return eNumbersInText(ingredientsText).some((e) => {
    const n = eCodeNumber(e);
    return n !== null && SWEETENER_CODES.has(n);
  });
}

/**
 * Additives from the tags, or from E-numbers in the text when tags are empty.
 * Sweeteners are left out: they have their own penalty, so they never count twice
 * (and a product scores the same whether its sweeteners are tagged or only named).
 */
export function countAdditives(additivesTags?: string[] | null, ingredientsText?: string | null): number {
  const tags = additivesTags ?? [];
  const codes = tags.length > 0 ? tags.map((t) => t.split(":").pop() ?? "") : ingredientsText ? eNumbersInText(ingredientsText) : [];
  return codes.filter((c) => {
    const n = eCodeNumber(c);
    return n === null || !SWEETENER_CODES.has(n);
  }).length;
}

export function bandForScore(score: number): ScoreBand {
  if (score >= GOOD_BAND_MIN) return "good";
  if (score >= BALANCE_BAND_MIN) return "balance";
  return "occasional";
}

function pillar(
  def: PillarDefinition,
  raw: number,
  known: boolean,
  noteKeys: string[] = [],
  applicable = true,
): PillarResult {
  const r = oneDecimal(clamp(raw));
  return {
    id: def.id,
    labelKey: def.labelKey,
    weight: def.weight,
    applicable,
    known,
    raw: r,
    score: clamp(roundHalfUp(r)),
    noteKeys,
  };
}

const def = (id: PillarId) => PILLARS.find((p) => p.id === id) as PillarDefinition;

// ─── Main ───────────────────────────────────────────────────────────────────

export function scoreProduct(input: ProductScoreInput): ProductScoreResult {
  const text = input.ingredientsText?.trim() || null;
  const tags = input.categoriesTags ?? [];
  const hasSugars = isNum(input.sugars100g);
  const nova = isNum(input.novaGroup) && NOVA_BASE[input.novaGroup] !== undefined ? input.novaGroup : null;
  const hasIngredientInfo = !!text || nova !== null;

  if (!hasSugars && !hasIngredientInfo) {
    return {
      score: null,
      band: null,
      reasons: [],
      confidence: "none",
      provisional: true,
      average: null,
      pillars: [],
      caps: [],
      wholeFood: false,
      floor: { limit: WHOLE_FOOD_FLOOR, applied: false },
      floorKind: null,
    };
  }
  // Label data that can't be right is treated like missing data.
  const implausible = nutritionLooksImplausible(input);
  const confidence: ScoreConfidence = hasSugars && hasIngredientInfo && !implausible ? "full" : "limited";
  const drink = isBeverage(tags);
  const sugarIngredientListed = !!text && SUGAR_INGREDIENT_PATTERN.test(text);
  const sugarFirst = !!text && hasSugarInFirstIngredients(text);
  const hasTag = (list: readonly string[]) => list.some((c) => tags.includes(c));
  const additiveTags = input.additivesTags ?? [];
  const additiveCount = countAdditives(additiveTags, text);
  const sweetened = hasArtificialSweetener(additiveTags, text);
  const noAdditives = additiveTags.length === 0 && (!text || eNumbersInText(text).length === 0) && !sweetened;

  // Pillar 1 — sugar
  let sugar: PillarResult;
  if (hasSugars) {
    const notes: string[] = [];
    const anchors = drink ? SUGAR_ANCHORS_DRINK : SUGAR_ANCHORS_FOOD;
    const full = input.sugars100g as number;
    const naturalEligible = !!text && !sugarIngredientListed;
    // Juice and smoothie sugars are free sugars: counted in full.
    const fullSugarDrink = hasTag(FULL_SUGAR_CATEGORIES);
    const value = naturalEligible && !fullSugarDrink ? full * NATURAL_SUGAR_FACTOR : full;
    let raw = interpolate(value, anchors);
    // Mention the gentler treatment (or its removal) only when halving would raise the score.
    if (naturalEligible && interpolate(full * NATURAL_SUGAR_FACTOR, anchors) > interpolate(full, anchors)) {
      notes.push(fullSugarDrink ? PILLAR_NOTE_KEYS.juiceSugar : PILLAR_NOTE_KEYS.naturalSugar);
    }
    if (sugarFirst) {
      raw = Math.max(MIN_SCORE, raw + SUGAR_IN_FIRST_INGREDIENTS_PENALTY);
      notes.push(PILLAR_NOTE_KEYS.sugarFirst);
    }
    sugar = pillar(def("sugar"), raw, true, notes);
  } else {
    sugar = pillar(def("sugar"), UNKNOWN_PILLAR_SCORE, false);
  }

  // Pillar 2 — salt
  const salt = isNum(input.salt100g)
    ? pillar(def("salt"), interpolate(input.salt100g, SALT_ANCHORS), true)
    : pillar(def("salt"), UNKNOWN_PILLAR_SCORE, false);

  // Pillar 3 — saturated fat (with category exceptions)
  const nutRichPlain = (min: number) =>
    isNum(input.fruitVegNuts100g) && input.fruitVegNuts100g >= min && !sugarIngredientListed && noAdditives;
  const exception = SAT_FAT_EXCEPTIONS.find(
    (ex) =>
      (hasTag(ex.categories) || (ex.nutsMin !== undefined && nutRichPlain(ex.nutsMin))) &&
      (!ex.plainOnly || !sugarIngredientListed),
  );
  const highCocoaDark =
    tags.includes(DARK_CHOCOLATE_CATEGORY) &&
    !!text &&
    startsWithCocoa(text) &&
    hasSugars &&
    (input.sugars100g as number) <= DARK_CHOCOLATE_MAX_SUGAR;
  let satFat: PillarResult;
  if (exception?.fixed !== undefined) {
    satFat = pillar(def("satFat"), exception.fixed, true, [exception.noteKey]);
  } else if (isNum(input.saturatedFat100g)) {
    let raw = interpolate(input.saturatedFat100g, SAT_FAT_ANCHORS);
    const notes: string[] = [];
    if (exception?.floor !== undefined && raw < exception.floor) {
      raw = exception.floor;
      notes.push(exception.noteKey);
    }
    if (highCocoaDark && raw < DARK_CHOCOLATE_SAT_FAT_FLOOR) {
      raw = DARK_CHOCOLATE_SAT_FAT_FLOOR;
      notes.push(PILLAR_NOTE_KEYS.cocoaFat);
    }
    satFat = pillar(def("satFat"), raw, true, notes);
  } else {
    satFat = pillar(def("satFat"), UNKNOWN_PILLAR_SCORE, false);
  }

  // Pillar 4 — processing
  const ingredientCount = isNum(input.ingredientsN) && input.ingredientsN > 0
    ? input.ingredientsN
    : text
      ? topLevelIngredients(text).length
      : null;
  let processing: PillarResult;
  let effectiveNova = nova;
  const processingNotes: string[] = [];
  if (effectiveNova === null && text) {
    if (sweetened || ULTRA_PROCESSED_MARKERS.test(text) || additiveCount >= NOVA4_ADDITIVE_COUNT) effectiveNova = 4;
    else if (additiveCount >= 1) effectiveNova = 3;
    if (effectiveNova !== null) processingNotes.push(PILLAR_NOTE_KEYS.novaInferred);
  }
  if (effectiveNova !== null) {
    let raw = NOVA_BASE[effectiveNova];
    if (sweetened) {
      raw += SWEETENER_PENALTY;
      processingNotes.push(PILLAR_NOTE_KEYS.sweeteners);
    }
    const additiveStep = ADDITIVE_STEPS.find(([min]) => additiveCount >= min);
    if (additiveStep) {
      raw += additiveStep[1];
      processingNotes.push(PILLAR_NOTE_KEYS.additives);
    }
    if (ingredientCount !== null) {
      if (ingredientCount <= SHORT_INGREDIENT_LIST) {
        raw += SHORT_LIST_BONUS;
        processingNotes.push(PILLAR_NOTE_KEYS.shortList);
      } else if (ingredientCount >= LONG_INGREDIENT_LIST) {
        raw += LONG_LIST_PENALTY;
        processingNotes.push(PILLAR_NOTE_KEYS.longList);
      }
    }
    processing = pillar(def("processing"), raw, true, processingNotes);
  } else {
    processing = pillar(def("processing"), UNKNOWN_PILLAR_SCORE, false);
  }

  // Pillar 5 — protein & fibre (foods only; highest signal with data)
  let proteinFibre: PillarResult;
  let bestPositive: string | null = null;
  if (drink) {
    proteinFibre = pillar(def("proteinFibre"), UNKNOWN_PILLAR_SCORE, true, [], false);
  } else {
    const signals: Array<[number, string]> = [];
    if (isNum(input.proteins100g)) signals.push([interpolate(input.proteins100g, PROTEIN_ANCHORS), REASON_KEYS.protein]);
    if (isNum(input.fiber100g)) signals.push([interpolate(input.fiber100g, FIBRE_ANCHORS), REASON_KEYS.fibre]);
    if (isNum(input.fruitVegNuts100g)) {
      signals.push([interpolate(input.fruitVegNuts100g, WHOLE_INGREDIENT_ANCHORS), REASON_KEYS.wholeIngredients]);
    }
    if (signals.length > 0) {
      // Highest signal wins; ties keep the order above (stable sort).
      const [best, key] = [...signals].sort((a, b) => b[0] - a[0])[0];
      // The signal is named only when it actually earns a good score.
      const strong = best >= POSITIVE_PILLAR_MIN - 0.5;
      proteinFibre = pillar(def("proteinFibre"), best, true, strong ? [key] : []);
      bestPositive = key;
    } else {
      proteinFibre = pillar(def("proteinFibre"), UNKNOWN_PILLAR_SCORE, false);
    }
  }

  const pillars = [sugar, salt, satFat, processing, proteinFibre];
  const used = pillars.filter((p) => p.applicable);
  const provisional = confidence === "limited" || used.some((p) => !p.known);

  // Combine
  const totalWeight = used.reduce((s, p) => s + p.weight, 0);
  const average = oneDecimal(used.reduce((s, p) => s + p.raw * p.weight, 0) / totalWeight);
  const overall = clamp(roundHalfUp(average));

  // Caps, in order: weakest link, sweeteners, provisional
  const caps: Array<{ id: CapId; limit: number }> = [];
  const limitScores = pillars.filter((p) => LIMIT_PILLARS.includes(p.id) && p.known).map((p) => p.score);
  if (limitScores.length > 0) {
    const weakest = Math.min(...limitScores);
    if (weakest <= WEAKEST_LINK_THRESHOLD) caps.push({ id: "weakest_link", limit: weakest + WEAKEST_LINK_MARGIN });
  }
  if (sweetened) caps.push({ id: "sweeteners", limit: SWEETENER_CAP });
  if (provisional) caps.push({ id: "provisional", limit: PROVISIONAL_CAP });
  const capped = clamp(Math.min(overall, ...caps.map((c) => c.limit)));
  const capResults: CapResult[] = caps.map((c) => ({
    ...c,
    applied: c.limit < overall && c.limit === capped,
  }));

  // Floors, after the caps. Pillars, the average and reasons stay as they are.
  const sugarExempt =
    sugarIngredientListed &&
    WHOLE_FOOD_SUGAR_EXEMPT_CATEGORIES.some((c) => tags.includes(c)) &&
    ingredientCount === 1 &&
    !!text &&
    !SUGAR_INGREDIENT_PATTERN.test(text.replace(/\bhoney\b/gi, " "));
  const wholeFood =
    (!sugarIngredientListed || sugarExempt) &&
    noAdditives &&
    // Pure honey with no NOVA group still counts: one ingredient and no additives say enough.
    (effectiveNova !== null || sugarExempt) &&
    (effectiveNova === null || WHOLE_FOOD_NOVA_GROUPS.includes(effectiveNova)) &&
    (effectiveNova === 1 ||
      (WHOLE_FOOD_CATEGORIES.some((c) => tags.includes(c)) &&
        ingredientCount !== null &&
        ingredientCount <= WHOLE_FOOD_MAX_INGREDIENTS)) &&
    !WHOLE_FOOD_EXCLUDED.some((c) => tags.includes(c));
  const animalFood =
    hasTag(ANIMAL_FOOD_CATEGORIES) &&
    sugar.known &&
    sugar.score >= ANIMAL_FLOOR_MIN_SUGAR_PILLAR &&
    !hasTag(ANIMAL_FOOD_EXCLUDED) &&
    !hasTag(DISH_CATEGORIES_FOR_FLOOR);
  const floors: Array<{ kind: FloorKind; limit: number }> = [];
  if (wholeFood) floors.push({ kind: "whole_food", limit: WHOLE_FOOD_FLOOR });
  if (animalFood) floors.push({ kind: "animal_food", limit: ANIMAL_FLOOR });
  if (highCocoaDark) floors.push({ kind: "dark_chocolate", limit: DARK_CHOCOLATE_FLOOR });
  // The highest floor wins (ties keep the order above).
  const topFloor = floors.reduce<(typeof floors)[number] | null>(
    (best, f) => (best === null || f.limit > best.limit ? f : best),
    null,
  );
  const floored = topFloor ? Math.max(capped, topFloor.limit) : capped;

  // Grain staple cap, last: it wins over every floor.
  let score = floored;
  if (hasTag(GRAIN_STAPLE_CATEGORIES)) {
    const whole = isNum(input.fiber100g) && input.fiber100g >= GRAIN_FIBRE_THRESHOLD;
    const limit = whole ? GRAIN_CAP_WHOLE : GRAIN_CAP_REFINED;
    capResults.push({ id: "grain_staple", limit, applied: limit < floored });
    score = Math.min(floored, limit);
  }

  // Reasons: worst pillars first, then the best positive.
  const flags: Array<{ severity: number; key: string }> = [];
  const flag = (p: PillarResult, high: string, some: string, extra = 0) => {
    if (!p.known) return;
    if (p.score <= WEAKEST_LINK_THRESHOLD) flags.push({ severity: p.score + extra, key: high });
    else if (p.score < GOOD_BAND_MIN) flags.push({ severity: p.score + extra, key: some });
  };
  flag(sugar, REASON_KEYS.highSugar, REASON_KEYS.someSugar);
  if (sugarFirst) flags.push({ severity: sugar.score + 0.1, key: REASON_KEYS.sugarFirst });
  flag(salt, REASON_KEYS.highSalt, REASON_KEYS.someSalt);
  flag(satFat, REASON_KEYS.highSatFat, REASON_KEYS.someSatFat);
  flag(processing, REASON_KEYS.ultraProcessed, REASON_KEYS.processed);
  if (sweetened) flags.push({ severity: processing.score + 0.2, key: REASON_KEYS.sweeteners });
  if (additiveCount >= MANY_ADDITIVES_COUNT) flags.push({ severity: processing.score + 0.3, key: REASON_KEYS.additives });

  const reasons = flags.sort((a, b) => a.severity - b.severity).map((f) => f.key);
  if (implausible) reasons.unshift(REASON_KEYS.dataLooksOff);
  const nothingFlagged = reasons.length === 0;
  if (proteinFibre.applicable && proteinFibre.known && proteinFibre.score >= POSITIVE_PILLAR_MIN && bestPositive) {
    reasons.push(bestPositive);
  }
  if (nothingFlagged && sugar.known && salt.known && satFat.known) reasons.push(REASON_KEYS.lowSugarSaltFat);

  return {
    score,
    band: bandForScore(score),
    reasons: [...new Set(reasons)].slice(0, MAX_REASONS),
    confidence,
    provisional,
    average,
    pillars,
    caps: capResults,
    wholeFood,
    floor: { limit: topFloor?.limit ?? WHOLE_FOOD_FLOOR, applied: score > capped },
    floorKind: topFloor?.kind ?? null,
  };
}
