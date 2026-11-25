// Scan & rate "Better options": finds UK products in the same category as a scanned
// product on Open Food Facts, preferring the user's store. No scoring happens here;
// the app scores and picks from the candidates.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { enrichInBatches, ENRICH_MAX_TRIED_GENERAL, ENRICH_MAX_TRIED_STORE } from "../_shared/offEnrich.ts";
import {
  OFF_FIELDS,
  OFF_USER_AGENT,
  alternateBarcode,
  offStr,
  toProductScoreData,
  type ProductScoreData,
} from "../_shared/offProduct.ts";
import { STORE_KEYS, STORE_SLUGS, categoriesToTry, isInStore, type StoreKey } from "../_shared/offCategories.ts";

const OFF_TIMEOUT_MS = 5000;
const PAGE_SIZE = 40;
const ENOUGH_CANDIDATES = 15;
const MAX_CANDIDATES = 60;

// ============================================
// In-memory cache per (category tag, store tag), edge function lifetime
// ============================================
// deno-lint-ignore no-explicit-any
const cache = new Map<string, { data: any[]; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// deno-lint-ignore no-explicit-any
function getCached(key: string): any[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  cache.delete(key);
  return null;
}

// deno-lint-ignore no-explicit-any
function setCache(key: string, data: any[]) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
  }
}

const BodySchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, "Barcode must be 8–14 digits"),
  categoriesTags: z.array(z.string().max(100)).max(30),
  store: z.enum(STORE_KEYS).nullish(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Open Food Facts' main search (api/v2/search). Throws on any failure. */
// deno-lint-ignore no-explicit-any
async function searchV2(tag: string, storeTag: string | null): Promise<any[]> {
  const url = new URL("https://world.openfoodfacts.org/api/v2/search");
  url.searchParams.set("categories_tags", tag);
  url.searchParams.set("countries_tags_en", "united-kingdom");
  if (storeTag) url.searchParams.set("stores_tags", storeTag);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("sort_by", "popularity_key");
  url.searchParams.set("fields", OFF_FIELDS);

  const res = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
    signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Open Food Facts search HTTP ${res.status}`);
  }
  const data = await res.json(); // throws on the HTML "temporarily unavailable" page
  if (!Array.isArray(data?.products)) throw new Error("Open Food Facts search: no products array");
  return data.products;
}

// Full product records, shared by every search in this instance.
// deno-lint-ignore no-explicit-any
const productCache = new Map<string, { data: any | null; ts: number }>();

/** Full product record from the product endpoint (less rate-limited than search). */
// deno-lint-ignore no-explicit-any
async function fetchProduct(code: string): Promise<any | null> {
  const hit = productCache.get(code);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${encodeURIComponent(OFF_FIELDS)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
    signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const data = await res.json();
  const product = data?.status === 1 && data.product ? data.product : null;
  productCache.set(code, { data: product, ts: Date.now() });
  if (productCache.size > 500) productCache.clear();
  return product;
}


const quote = (v: string) => `"${v.replace(/["\\]/g, "")}"`;

/**
 * Fallback used when api/v2/search fails (from the server it answers 503 most of
 * the time). The newer search service returns popularity-ranked UK barcodes but
 * lacks ingredient text, additives and store tags, so only the top hits are
 * re-read from the product endpoint, and only fully read products are kept so
 * scores stay comparable. It asks for Nutri-Score A, B or C, so categories where
 * few products score well (sauces, spreads) still return something to compare.
 */
// deno-lint-ignore no-explicit-any
async function searchFallback(tag: string, store: StoreKey | null): Promise<any[]> {
  let q = `categories_tags:${quote(tag)} AND countries_tags:"en:united-kingdom" AND nutriscore_grade:(a OR b OR c)`;
  if (store) q += ` AND stores:(${STORE_SLUGS[store].names.map(quote).join(" OR ")})`;
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("sort_by", "-popularity_key");
  url.searchParams.set("fields", "code,product_name,product_name_en");

  const res = await fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
    signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Open Food Facts fallback search HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data?.hits)) throw new Error("Open Food Facts fallback search: no hits array");
  const codes: string[] = data.hits
    .filter((h: { product_name?: unknown; product_name_en?: unknown }) => offStr(h?.product_name) || offStr(h?.product_name_en))
    .map((h: { code?: unknown }) => offStr(h?.code))
    .filter((c: string | null): c is string => !!c);
  // Re-read in batches of 8 until 12 usable products or the try limit (32, store 12).
  return await enrichInBatches(codes, (c) => fetchProduct(c), {
    maxTried: store ? ENRICH_MAX_TRIED_STORE : ENRICH_MAX_TRIED_GENERAL,
  });
}

// ============================================
// Persistent cache (off_category_cache), service role only
// ============================================
const DB_FRESH_MS = 24 * 60 * 60 * 1000;
const DB_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// deno-lint-ignore no-explicit-any
async function readDbCache(key: string, maxAgeMs: number): Promise<any[] | null> {
  try {
    const { data, error } = await admin
      .from("off_category_cache")
      .select("products, fetched_at")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    if (Date.now() - new Date(data.fetched_at).getTime() > maxAgeMs) return null;
    return Array.isArray(data.products) && data.products.length > 0 ? data.products : null;
  } catch (err) {
    console.warn(`[product-alternatives] cache read failed for ${key}:`, String(err));
    return null;
  }
}

// deno-lint-ignore no-explicit-any
async function writeDbCache(key: string, products: any[]) {
  try {
    const { error } = await admin
      .from("off_category_cache")
      .upsert({ key, products, fetched_at: new Date().toISOString() });
    if (error) console.warn(`[product-alternatives] cache write failed for ${key}:`, error.message);
  } catch (err) {
    console.warn(`[product-alternatives] cache write failed for ${key}:`, String(err));
  }
}

type Source = "live" | "cache" | "stale";

/**
 * One UK search page for a category (optionally a store): memory, then the table
 * (under 24h), then live search (v2, then fallback), then a table row up to 30 days
 * old. Throws when nothing is available.
 */
// deno-lint-ignore no-explicit-any
async function searchCategory(tag: string, store: StoreKey | null): Promise<{ products: any[]; source: Source }> {
  const storeTag = store ? STORE_SLUGS[store].query[0] : null;
  const key = `${tag}|${storeTag ?? ""}`;
  const cached = getCached(key);
  if (cached) return { products: cached, source: "cache" };
  const fresh = await readDbCache(key, DB_FRESH_MS);
  if (fresh) {
    setCache(key, fresh);
    return { products: fresh, source: "cache" };
  }

  let products;
  try {
    try {
      products = await searchV2(tag, storeTag);
    } catch (err) {
      console.warn(`[product-alternatives] v2 search failed for ${key}, trying fallback:`, String(err));
      products = await searchFallback(tag, store);
    }
  } catch (err) {
    const stale = await readDbCache(key, DB_STALE_MS);
    if (stale) {
      console.warn(`[product-alternatives] live searches failed for ${key}, using stale cache`);
      return { products: stale, source: "stale" };
    }
    throw err;
  }
  if (products.length > 0) {
    setCache(key, products);
    await writeDbCache(key, products);
  }
  return { products, source: "live" };
}

const isPromising = (p: ProductScoreData) => p.nutriscore_grade === "a" || p.nutriscore_grade === "b";

/**
 * Keeps at most MAX_CANDIDATES. When there are too many, store-tagged and
 * promising products are kept over the rest; the original order is preserved.
 */
function trimCandidates<T extends ProductScoreData & { inStore: boolean }>(list: T[]): T[] {
  if (list.length <= MAX_CANDIDATES) return list;
  const keep = new Set<T>();
  for (const pass of [(c: T) => c.inStore, (c: T) => isPromising(c), () => true]) {
    for (const c of list) {
      if (keep.size >= MAX_CANDIDATES) break;
      if (pass(c)) keep.add(c);
    }
  }
  return list.filter((c) => keep.has(c));
}

type Candidate = ProductScoreData & { inStore: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Signed-in users only.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authError || !claims?.claims) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const { barcode, categoriesTags } = parsed.data;
  const store = (parsed.data.store ?? null) as StoreKey | null;

  try {
    const tags = categoriesToTry(categoriesTags);

    const skip = new Set([barcode]);
    const alt = alternateBarcode(barcode);
    if (alt) skip.add(alt);

    const candidates: Candidate[] = [];
    let matchedCategory: string | null = null;
    let generalSearchWorked = false;
    // Counts only promising general-search results (Nutri-Score A/B), so picking a
    // store never narrows the search and a category full of near-copies of the
    // scanned product (e.g. 40 diet colas) doesn't stop it before broader ones.
    let promisingCount = 0;
    const sources = new Set<Source>();

    for (const tag of tags) {
      // Store search first (best effort), then the general UK search, in parallel.
      const results = await Promise.allSettled([
        store ? searchCategory(tag, store) : Promise.resolve({ products: [], source: "live" as Source }),
        searchCategory(tag, null),
      ]);
      for (const [i, result] of results.entries()) {
        if (result.status === "rejected") {
          console.error(`[product-alternatives] search failed for ${tag}:`, String(result.reason));
          continue;
        }
        if (i === 1) generalSearchWorked = true;
        sources.add(result.value.source);
        for (const raw of result.value.products) {
          const code = offStr(raw?.code);
          if (!code || skip.has(code)) continue;
          if (!offStr(raw?.product_name) && !offStr(raw?.product_name_en)) continue;
          skip.add(code);
          const clean = toProductScoreData(raw);
          candidates.push({ ...clean, inStore: isInStore(clean.stores_tags, store) });
          if (i === 1 && isPromising(clean)) promisingCount++;
          if (!matchedCategory) matchedCategory = tag;
        }
      }
      if (promisingCount >= ENOUGH_CANDIDATES) break;
    }

    // Worst source used: stale beats cache beats live.
    const source: Source = sources.has("stale") ? "stale" : sources.has("cache") ? "cache" : "live";
    console.log(`[product-alternatives] source=${source} candidates=${candidates.length}`);
    // Store results alone are not enough to say "no better options": report an error.
    if (tags.length > 0 && !generalSearchWorked) {
      return json({ candidates: [], matchedCategory: null, error: true, source });
    }
    return json({ candidates: trimCandidates(candidates), matchedCategory, error: false, source });
  } catch (err) {
    console.error("[product-alternatives] failed:", err);
    return json({ candidates: [], matchedCategory: null, error: true });
  }
});
