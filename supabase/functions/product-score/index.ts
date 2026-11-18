// Scan & rate: looks up a packaged product on Open Food Facts and returns the
// raw values the client-side score needs. No scoring happens here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import {
  OFF_FIELDS as FIELDS,
  OFF_USER_AGENT as USER_AGENT,
  alternateBarcode,
  toProductScoreData as toResult,
  type ProductScoreData,
} from "../_shared/offProduct.ts";

const OFF_TIMEOUT_MS = 5000;

// ============================================
// In-memory response cache (edge function lifetime)
// ============================================
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
  }
}

const BodySchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, "Barcode must be 8–14 digits"),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Returns the product, null when OFF has no such product; throws on network/HTTP failure.
// deno-lint-ignore no-explicit-any
async function fetchProduct(barcode: string): Promise<any | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${encodeURIComponent(FIELDS)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
  });
  if (res.status === 404) {
    await res.body?.cancel();
    return null;
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Open Food Facts HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.status === 1 && data.product ? data.product : null;
}

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
  const { barcode } = parsed.data;

  const cacheKey = `score_${barcode}`;
  const cached = getCached<ProductScoreData | { found: false }>(cacheKey);
  if (cached) return json(cached);

  try {
    let product = await fetchProduct(barcode);
    const alt = product ? null : alternateBarcode(barcode);
    if (alt) product = await fetchProduct(alt);

    const result = product ? toResult(product) : { found: false };
    setCache(cacheKey, result);
    return json(result);
  } catch (err) {
    const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error("[product-score] lookup failed:", err);
    return json(
      { error: timedOut ? "The product database took too long to respond." : "Couldn't reach the product database." },
      timedOut ? 504 : 502,
    );
  }
});
