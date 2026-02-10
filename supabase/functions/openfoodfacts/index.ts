import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENT = 'CJTNutrition - Nutrition Tracking App - contact@cjtnutrition.com';

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
  // Evict old entries if cache grows too large
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 50; i++) cache.delete(oldest[i][0]);
  }
}

// ============================================
// Open Food Facts API
// ============================================

interface OFFNutritionResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: number;
  servingUnit: string;
  source: 'openfoodfacts';
  brandName?: string;
  imageUrl?: string;
  barcode?: string;
  countries?: string;
  nutritionSource: 'barcode_verified' | 'branded_verified' | 'database_generic';
  confidenceScore: number;
}

async function offBarcodeSearch(barcode: string): Promise<OFFNutritionResult | null> {
  const cacheKey = `off_barcode_${barcode}`;
  const cached = getCached<OFFNutritionResult>(cacheKey);
  if (cached) {
    console.log(`[OFF] Cache hit for barcode: ${barcode}`);
    return cached;
  }

  try {
    console.log(`[OFF] Looking up barcode: ${barcode}`);
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) {
      console.log(`[OFF] HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== 1 || !data.product) {
      console.log(`[OFF] Product not found for barcode: ${barcode}`);
      return null;
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    const calories = nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0;
    const protein = nutriments.proteins_100g ?? nutriments.proteins ?? 0;
    const carbs = nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0;
    const fats = nutriments.fat_100g ?? nutriments.fat ?? 0;

    if (calories === 0 && protein === 0 && carbs === 0 && fats === 0) {
      console.log(`[OFF] No nutrition data for barcode: ${barcode}`);
      return null;
    }

    const productName = product.product_name || product.product_name_en || 'Unknown Product';
    const brandName = product.brands || undefined;
    const servingSize = parseFloat(product.serving_quantity) || 100;

    const result: OFFNutritionResult = {
      name: brandName ? `${brandName} ${productName}` : productName,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
      servingSize,
      servingUnit: 'g',
      source: 'openfoodfacts',
      brandName,
      imageUrl: product.image_url || undefined,
      barcode,
      countries: product.countries || undefined,
      nutritionSource: brandName ? 'barcode_verified' : 'database_generic',
      confidenceScore: brandName ? 0.95 : 0.85,
    };

    setCache(cacheKey, result);
    console.log(`[OFF] Found: ${result.name} (${result.calories} kcal/100g)`);
    return result;
  } catch (error) {
    console.error('[OFF] Barcode error:', error);
    return null;
  }
}

async function offTextSearch(query: string, limit = 5, region: 'world' | 'uk' = 'uk'): Promise<OFFNutritionResult[]> {
  const cacheKey = `off_search_${region}_${query}_${limit}`;
  const cached = getCached<OFFNutritionResult[]>(cacheKey);
  if (cached) {
    console.log(`[OFF] Cache hit for search: ${query} (${region})`);
    return cached;
  }

  try {
    const domain = region === 'uk' ? 'uk.openfoodfacts.org' : 'world.openfoodfacts.org';
    const encodedQuery = encodeURIComponent(query);
    console.log(`[OFF] Searching ${domain} for: ${query}`);

    const response = await fetch(
      `https://${domain}/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&json=1&page_size=${limit}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );

    if (!response.ok) {
      console.log(`[OFF] Search HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.products || data.products.length === 0) {
      console.log(`[OFF] No search results for: ${query}`);
      return [];
    }

    const results: OFFNutritionResult[] = [];

    for (const product of data.products.slice(0, limit)) {
      const nutriments = product.nutriments || {};
      const calories = nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0;
      const protein = nutriments.proteins_100g ?? nutriments.proteins ?? 0;
      const carbs = nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0;
      const fats = nutriments.fat_100g ?? nutriments.fat ?? 0;

      if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
        const productName = product.product_name || product.product_name_en || query;
        const brandName = product.brands || undefined;

        results.push({
          name: brandName ? `${brandName} ${productName}` : productName,
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fats: Math.round(fats * 10) / 10,
          servingSize: parseFloat(product.serving_quantity) || 100,
          servingUnit: 'g',
          source: 'openfoodfacts',
          brandName,
          imageUrl: product.image_url || undefined,
          barcode: product.code || undefined,
          countries: product.countries || undefined,
          nutritionSource: brandName ? 'branded_verified' : 'database_generic',
          confidenceScore: brandName ? 0.9 : 0.8,
        });
      }
    }

    setCache(cacheKey, results);
    console.log(`[OFF] Found ${results.length} results for: ${query} (${region})`);
    return results;
  } catch (error) {
    console.error('[OFF] Search error:', error);
    return [];
  }
}

// ============================================
// FoodRepo API (foodrepo.org — Swiss/EU database)
// ============================================

interface FoodRepoResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: number;
  source: 'foodrepo';
  brandName?: string;
  barcode?: string;
  nutritionSource: 'branded_verified' | 'database_generic';
  confidenceScore: number;
}

async function foodRepoSearch(query: string, limit = 3): Promise<FoodRepoResult[]> {
  const cacheKey = `foodrepo_search_${query}_${limit}`;
  const cached = getCached<FoodRepoResult[]>(cacheKey);
  if (cached) {
    console.log(`[FoodRepo] Cache hit for: ${query}`);
    return cached;
  }

  try {
    console.log(`[FoodRepo] Searching for: ${query}`);
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://www.foodrepo.org/api/v3/products?q=${encodedQuery}&page_size=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Token token=""',
        },
      }
    );

    if (!response.ok) {
      console.log(`[FoodRepo] HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const products = data?.data || [];

    if (products.length === 0) {
      console.log(`[FoodRepo] No results for: ${query}`);
      return [];
    }

    const results: FoodRepoResult[] = [];

    for (const product of products.slice(0, limit)) {
      const nutrients = product.attributes?.nutrients || {};
      const nameData = product.attributes?.display_name_translations;
      const productName = nameData?.en || nameData?.de || nameData?.fr || query;
      const barcode = product.attributes?.barcode || undefined;

      // Nutrients are per 100g in FoodRepo
      const calories = nutrients?.['energy-kcal']?.per_hundred || nutrients?.energy?.per_hundred || 0;
      const protein = nutrients?.protein?.per_hundred || 0;
      const carbs = nutrients?.carbohydrates?.per_hundred || 0;
      const fats = nutrients?.fat?.per_hundred || 0;

      if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
        results.push({
          name: productName,
          calories: Math.round(calories),
          protein: Math.round(protein * 10) / 10,
          carbs: Math.round(carbs * 10) / 10,
          fats: Math.round(fats * 10) / 10,
          servingSize: 100,
          source: 'foodrepo',
          brandName: undefined,
          barcode,
          nutritionSource: barcode ? 'branded_verified' : 'database_generic',
          confidenceScore: 0.85,
        });
      }
    }

    setCache(cacheKey, results);
    console.log(`[FoodRepo] Found ${results.length} results for: ${query}`);
    return results;
  } catch (error) {
    console.error('[FoodRepo] Error:', error);
    return [];
  }
}

async function foodRepoBarcodeSearch(barcode: string): Promise<FoodRepoResult | null> {
  const cacheKey = `foodrepo_barcode_${barcode}`;
  const cached = getCached<FoodRepoResult>(cacheKey);
  if (cached) {
    console.log(`[FoodRepo] Cache hit for barcode: ${barcode}`);
    return cached;
  }

  try {
    console.log(`[FoodRepo] Looking up barcode: ${barcode}`);
    const response = await fetch(
      `https://www.foodrepo.org/api/v3/products?barcodes=${barcode}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Token token=""',
        },
      }
    );

    if (!response.ok) {
      console.log(`[FoodRepo] Barcode HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const products = data?.data || [];
    if (products.length === 0) {
      console.log(`[FoodRepo] No barcode match for: ${barcode}`);
      return null;
    }

    const product = products[0];
    const nutrients = product.attributes?.nutrients || {};
    const nameData = product.attributes?.display_name_translations;
    const productName = nameData?.en || nameData?.de || nameData?.fr || 'Unknown Product';

    const calories = nutrients?.['energy-kcal']?.per_hundred || nutrients?.energy?.per_hundred || 0;
    const protein = nutrients?.protein?.per_hundred || 0;
    const carbs = nutrients?.carbohydrates?.per_hundred || 0;
    const fats = nutrients?.fat?.per_hundred || 0;

    if (calories === 0 && protein === 0 && carbs === 0 && fats === 0) {
      return null;
    }

    const result: FoodRepoResult = {
      name: productName,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fats: Math.round(fats * 10) / 10,
      servingSize: 100,
      source: 'foodrepo',
      barcode,
      nutritionSource: 'branded_verified',
      confidenceScore: 0.9,
    };

    setCache(cacheKey, result);
    console.log(`[FoodRepo] Found: ${result.name} (${result.calories} kcal/100g)`);
    return result;
  } catch (error) {
    console.error('[FoodRepo] Barcode error:', error);
    return null;
  }
}

// ============================================
// HTTP Handler
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1] === 'openfoodfacts'
      ? (url.searchParams.get('action') || 'search')
      : pathParts[pathParts.length - 1];

    // ---- Barcode lookup: OFF → FoodRepo ----
    if (action === 'barcode') {
      const barcode = url.searchParams.get('barcode');
      if (!barcode) {
        return new Response(JSON.stringify({ error: 'barcode parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Proxy] Barcode lookup: ${barcode}`);

      // Try OFF first
      const offResult = await offBarcodeSearch(barcode);
      if (offResult) {
        return new Response(JSON.stringify({ result: offResult, source: 'openfoodfacts' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fallback to FoodRepo
      const frResult = await foodRepoBarcodeSearch(barcode);
      if (frResult) {
        return new Response(JSON.stringify({ result: frResult, source: 'foodrepo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ result: null, source: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Text search: OFF (UK first, then world) + FoodRepo ----
    if (action === 'search') {
      const query = url.searchParams.get('query');
      if (!query) {
        return new Response(JSON.stringify({ error: 'query parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[Proxy] Text search: ${query}`);

      // Search UK OFF and FoodRepo in parallel
      const [ukResults, frResults] = await Promise.all([
        offTextSearch(query, 4, 'uk'),
        foodRepoSearch(query, 3),
      ]);

      // If UK results are sparse, also try world OFF
      let worldResults: OFFNutritionResult[] = [];
      if (ukResults.length < 2) {
        worldResults = await offTextSearch(query, 3, 'world');
      }

      // Merge: UK OFF → FoodRepo → World OFF (deduplicated)
      const allResults: Array<OFFNutritionResult | FoodRepoResult> = [];
      const seenNames = new Set<string>();

      for (const r of [...ukResults, ...frResults, ...worldResults]) {
        const key = r.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allResults.push(r);
        }
      }

      return new Response(JSON.stringify({
        results: allResults.slice(0, 8),
        counts: {
          openfoodfacts_uk: ukResults.length,
          foodrepo: frResults.length,
          openfoodfacts_world: worldResults.length,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown endpoint. Use /barcode or /search' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[OpenFoodFacts Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
