/**
 * Scan & rate "Better options": picks up to 3 better products from the candidates
 * the product-alternatives function returns. Pure and unit-tested; scoring itself
 * comes unchanged from foodScore.ts.
 */
import { REASON_KEYS, scoreProduct, type ScoreBand } from "@/lib/foodScore";
import { toScoreInput, type ProductLookup } from "@/lib/productScoreService";
import { alternateBarcode } from "../../supabase/functions/_shared/offProduct.ts";
import { BROAD_CATEGORIES, categoriesToTry, type StoreKey } from "../../supabase/functions/_shared/offCategories.ts";

export type AlternativeCandidate = ProductLookup & { inStore: boolean };

export interface Alternative {
  product: AlternativeCandidate;
  score: number;
  band: ScoreBand;
  /** i18n key of the single most helpful positive reason, or null. */
  reasonKey: string | null;
  inStore: boolean;
}

export interface AlternativesPick {
  alternatives: Alternative[];
  anyInStore: boolean;
  usedStore: StoreKey | null;
  /** True when nothing passed the strict bar and the relaxed one was used. */
  relaxed: boolean;
}

export const MAX_ALTERNATIVES = 3;
/** An alternative must beat the scanned product by at least this much… */
export const MIN_SCORE_GAIN = 2;
/** …and score at least this on its own. */
export const MIN_ALTERNATIVE_SCORE = 6;
/** Second pass, used only when the strict pass finds nothing. */
export const RELAXED_MIN_ALTERNATIVE_SCORE = 5;

/**
 * Prepared dishes: a candidate tagged with one of these is a different kind of
 * product (an egg salad is not a mayonnaise), unless the scanned product has the same tag.
 */
export const DISH_CATEGORIES = [
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

const POSITIVE_REASONS = new Set<string>([
  REASON_KEYS.fibre,
  REASON_KEYS.protein,
  REASON_KEYS.wholeIngredients,
  REASON_KEYS.lowSugarSaltFat,
]);
const SUGAR_SALT_FAT_REASONS = new Set<string>([
  REASON_KEYS.highSugar,
  REASON_KEYS.someSugar,
  REASON_KEYS.sugarFirst,
  REASON_KEYS.highSalt,
  REASON_KEYS.someSalt,
  REASON_KEYS.highSatFat,
  REASON_KEYS.someSatFat,
]);

/** Lowercase, drop the brand when the name starts with it, keep letters/digits only. */
export function normaliseProductName(name: string, brands?: string | null): string {
  let n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const brand = brands?.split(",")[0]?.trim().toLowerCase();
  if (brand && n.startsWith(brand) && n.length > brand.length) n = n.slice(brand.length);
  return n.replace(/[^a-z0-9]+/g, " ").trim();
}

function reasonFor(reasons: string[], c: ProductLookup): string | null {
  const positive = reasons.find((r) => POSITIVE_REASONS.has(r));
  if (positive) return positive;
  const n = c.nutriments;
  const allKnown =
    n && n.sugars_100g !== null && n.salt_100g !== null && n.saturated_fat_100g !== null;
  if (allKnown && !reasons.some((r) => SUGAR_SALT_FAT_REASONS.has(r))) return REASON_KEYS.lowSugarSaltFat;
  return null;
}

export function pickAlternatives(
  scanned: { barcode: string; score: number; categoriesTags: string[] | null | undefined },
  candidates: AlternativeCandidate[],
  store?: StoreKey | null,
): AlternativesPick {
  const usedStore = store ?? null;
  const scannedCodes = new Set([scanned.barcode]);
  const alt = alternateBarcode(scanned.barcode);
  if (alt) scannedCodes.add(alt);
  const scannedTags = new Set((scanned.categoriesTags ?? []).map((t) => t.trim().toLowerCase()));
  // Like-for-like: tier 1 shares the most specific category, tier 2 only the next one.
  const [primary, secondary] = categoriesToTry(scanned.categoriesTags);
  if (!primary) return { alternatives: [], anyInStore: false, usedStore, relaxed: false };

  const tagsOf = (p: AlternativeCandidate) => (p?.categories_tags ?? []).map((t) => t.trim().toLowerCase());
  // Tier 2 only when no candidate at all shares the most specific category, and
  // never for a broad category (en:sauces would let an egg salad replace a mayonnaise).
  const anyTier1 = candidates.some((p) => p && tagsOf(p).includes(primary));
  const tier2Tag = !anyTier1 && secondary && !BROAD_CATEGORIES.has(secondary) ? secondary : null;
  const tier = anyTier1 ? 1 : 2;
  const tierTag = anyTier1 ? primary : tier2Tag;
  if (!tierTag) return { alternatives: [], anyInStore: false, usedStore, relaxed: false };

  const scored = candidates
    .map((product, index) => {
      if (!product?.code || scannedCodes.has(product.code)) return null;
      const name = product.product_name_en || product.product_name;
      if (!name) return null;
      const tags = tagsOf(product);
      if (!tags.includes(tierTag)) return null;
      if (tags.some((t) => DISH_CATEGORIES.includes(t) && !scannedTags.has(t))) return null;
      const result = scoreProduct(toScoreInput(product));
      if (result.confidence !== "full" || result.provisional || result.score === null || result.band === null) {
        return null;
      }
      const sharedTags = tags.filter((t) => scannedTags.has(t)).length;
      const inStore = !!usedStore && product.inStore === true;
      return {
        index,
        tier,
        sharedTags,
        key: normaliseProductName(name, product.brands),
        alt: {
          product,
          score: result.score,
          band: result.band,
          reasonKey: reasonFor(result.reasons, product),
          inStore,
        } satisfies Alternative,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const gainMin = scanned.score + MIN_SCORE_GAIN;
  const strict = scored.filter((q) => q.alt.score >= Math.max(gainMin, MIN_ALTERNATIVE_SCORE));
  const relaxed = strict.length === 0;
  const qualified = relaxed
    ? scored.filter((q) => q.alt.score >= Math.max(gainMin, RELAXED_MIN_ALTERNATIVE_SCORE))
    : strict;
  const ranked = qualified.sort(
    (a, b) =>
      Number(b.alt.inStore) - Number(a.alt.inStore) ||
      b.alt.score - a.alt.score ||
      b.sharedTags - a.sharedTags ||
      a.index - b.index,
  );

  const seen = new Set<string>();
  const alternatives: Alternative[] = [];
  for (const q of ranked) {
    if (seen.has(q.key)) continue;
    seen.add(q.key);
    alternatives.push(q.alt);
    if (alternatives.length === MAX_ALTERNATIVES) break;
  }

  return {
    alternatives,
    anyInStore: alternatives.some((a) => a.inStore),
    usedStore,
    relaxed: relaxed && alternatives.length > 0,
  };
}
