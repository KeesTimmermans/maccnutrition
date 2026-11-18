// Category and UK store helpers for Scan & rate "Better options".
// Pure TypeScript (no Deno imports) so the edge function, the app and vitest share it.

/** Categories too broad to find a like-for-like swap. */
export const GENERIC_CATEGORIES = new Set([
  "en:foods",
  "en:food",
  "en:beverages",
  "en:plant-based-foods-and-beverages",
  "en:plant-based-foods",
  "en:groceries",
  "en:snacks",
  "en:sweet-snacks",
  "en:non-alcoholic-beverages",
]);

export const MAX_CATEGORIES_TO_TRY = 3;

/**
 * Open Food Facts lists categories_tags from general to specific. Returns up to 3
 * of the most specific English tags, most specific first, skipping generic ones.
 * Tags in other languages (e.g. "pt:bebidas cafeína") are skipped because they are
 * one-off free-text tags that rarely match other products.
 */
export function categoriesToTry(categoriesTags: string[] | null | undefined): string[] {
  const out: string[] = [];
  const tags = (categoriesTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (let i = tags.length - 1; i >= 0 && out.length < MAX_CATEGORIES_TO_TRY; i--) {
    const tag = tags[i];
    if (!tag.startsWith("en:")) continue;
    if (GENERIC_CATEGORIES.has(tag) || out.includes(tag)) continue;
    out.push(tag);
  }
  return out;
}

export const STORE_KEYS = [
  "tesco",
  "sainsburys",
  "asda",
  "morrisons",
  "aldi",
  "lidl",
  "coop",
  "marks_and_spencer",
  "waitrose",
  "iceland",
  "ocado",
] as const;
export type StoreKey = (typeof STORE_KEYS)[number];

export const isStoreKey = (v: unknown): v is StoreKey =>
  typeof v === "string" && (STORE_KEYS as readonly string[]).includes(v);

/**
 * query: Open Food Facts store tag(s) to search with (first = primary).
 * match: how the store is recognised in a product's stores_tags after normalising.
 * names: store names as people type them, for the fallback search service, which
 *   matches the product's store names exactly (ignoring case) rather than tags.
 */
export const STORE_SLUGS: Record<StoreKey, { query: string[]; match: string[]; names: string[] }> = {
  tesco: { query: ["tesco"], match: ["tesco"], names: ["Tesco"] },
  sainsburys: { query: ["sainsbury-s"], match: ["sainsbury"], names: ["Sainsbury's", "Sainsburys"] },
  asda: { query: ["asda"], match: ["asda"], names: ["Asda"] },
  morrisons: { query: ["morrisons"], match: ["morrisons"], names: ["Morrisons"] },
  aldi: { query: ["aldi"], match: ["aldi"], names: ["Aldi"] },
  lidl: { query: ["lidl"], match: ["lidl"], names: ["Lidl"] },
  coop: { query: ["co-op"], match: ["coop", "co-op"], names: ["Co-op", "Coop", "The Co-operative"] },
  marks_and_spencer: {
    query: ["marks-spencer"],
    match: ["marks-and-spencer", "marks-spencer", "m-s", "mands"],
    names: ["Marks & Spencer", "M&S", "M&S Food"],
  },
  waitrose: { query: ["waitrose"], match: ["waitrose"], names: ["Waitrose"] },
  iceland: { query: ["iceland"], match: ["iceland"], names: ["Iceland"] },
  ocado: { query: ["ocado"], match: ["ocado"], names: ["Ocado"] },
};

/**
 * Lowercase, drop accents and apostrophes, and turn every other run of
 * punctuation or spaces into a single "-": "Marks & Spencer" -> "marks-spencer",
 * "Sainsbury's" -> "sainsburys", "M&S" -> "m-s".
 */
export function normaliseStoreTag(tag: string): string {
  return tag
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[a-z]{2}:/, "")
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Matches whole "-"-separated words, letting the last word of the pattern be the
 * start of a word ("sainsbury" matches "sainsburys"). Whole-word matching stops
 * short patterns such as "m-s" matching inside unrelated names like "farm-shop".
 */
function matchesPattern(tokens: string[], pattern: string): boolean {
  const p = pattern.split("-").filter(Boolean);
  if (p.length === 0) return false;
  for (let i = 0; i + p.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) {
      const token = tokens[i + j];
      const last = j === p.length - 1;
      if (last ? !token.startsWith(p[j]) : token !== p[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** True only when the product's own store tags name the store. */
export function isInStore(storesTags: string[] | null | undefined, storeKey: StoreKey | null | undefined): boolean {
  if (!storeKey || !STORE_SLUGS[storeKey]) return false;
  const patterns = STORE_SLUGS[storeKey].match;
  return (storesTags ?? []).some((tag) => {
    if (typeof tag !== "string") return false;
    const tokens = normaliseStoreTag(tag).split("-").filter(Boolean);
    return patterns.some((pattern) => matchesPattern(tokens, pattern));
  });
}
