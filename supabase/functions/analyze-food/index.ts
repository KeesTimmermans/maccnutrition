import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TIMEOUT HELPER - prevents hanging on slow external APIs
// ============================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================
// NUTRITION DATABASE LOOKUPS (inline for edge function)
// ============================================

interface NutritionData {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize?: number;
  servingUnit?: string;
  source: 'open_food_facts' | 'usda' | 'uk_cofid' | 'ai_estimation' | 'branded_verified' | 'fatsecret' | 'openfoodfacts' | 'foodrepo';
  nutritionSource: 'branded_verified' | 'barcode_verified' | 'database_generic' | 'estimate';
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  brandName?: string;
  imageUrl?: string;
  isChainRestaurant?: boolean;
  requiresConfirmation?: boolean;
  sourceMetadata?: Record<string, unknown>;
  candidateMatches?: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    source: string;
  }>;
}

interface NutritionPer100g {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  defaultServingSize: number;
  source: 'open_food_facts' | 'usda' | 'uk_cofid' | 'ai_estimation' | 'branded_verified' | 'fatsecret' | 'openfoodfacts' | 'foodrepo';
  nutritionSource?: 'branded_verified' | 'barcode_verified' | 'database_generic' | 'estimate';
  confidenceScore?: number;
  brandName?: string;
}

// ============================================
// BRAND/CHAIN DETECTION
// ============================================

const RESTAURANT_CHAINS = [
  'joe & the juice', 'joe and the juice', 'starbucks', 'costa', 'pret', 'pret a manger',
  'dunkin', 'dunkin donuts', 'tim hortons', 'caribou coffee', 'dutch bros',
  'jamba', 'jamba juice', 'smoothie king', 'tropical smoothie',
  'mcdonalds', "mcdonald's", 'burger king', 'wendys', "wendy's", 'five guys',
  'shake shack', 'in-n-out', 'in n out', 'whataburger', 'carls jr', "carl's jr",
  'chipotle', 'qdoba', 'taco bell', 'del taco', 'subway', 'jersey mikes',
  'panera', 'panera bread', 'dominos', "domino's", 'pizza hut', 'papa johns',
  'chick-fil-a', 'chick fil a', 'popeyes', 'kfc', 'raising canes', 'wingstop',
  'nandos', "nando's", 'greggs', 'leon', 'wagamama', 'itsu', 'wasabi',
  'sweetgreen', 'cava', 'dig inn', 'chopt', 'just salad',
];

function detectChainRestaurant(input: string): { isChain: boolean; chainName?: string } {
  const normalized = input.toLowerCase().trim();
  for (const chain of RESTAURANT_CHAINS) {
    if (normalized.includes(chain)) {
      return { isChain: true, chainName: chain };
    }
  }
  return { isChain: false };
}

// ============================================
// OPEN FOOD FACTS - UK/EU prioritized search
// ============================================

async function searchOpenFoodFactsUK(query: string, limit: number = 5): Promise<NutritionPer100g[]> {
  try {
    console.log(`[OFF-UK] Searching for: ${query}`);
    const encodedQuery = encodeURIComponent(query);
    const response = await fetchWithTimeout(
      `https://uk.openfoodfacts.org/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&json=1&page_size=${limit}`,
      { headers: { 'User-Agent': 'CJTNutrition - Nutrition Tracking App - contact@cjtnutrition.com' } },
      5000
    );

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.products || data.products.length === 0) return [];

    const results: NutritionPer100g[] = [];
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
          caloriesPer100g: Math.round(calories),
          proteinPer100g: Math.round(protein * 10) / 10,
          carbsPer100g: Math.round(carbs * 10) / 10,
          fatsPer100g: Math.round(fats * 10) / 10,
          defaultServingSize: parseFloat(product.serving_quantity) || 100,
          source: 'openfoodfacts' as const,
          nutritionSource: brandName ? 'branded_verified' : 'database_generic',
          confidenceScore: brandName ? 0.92 : 0.82,
          brandName,
        });
      }
    }

    console.log(`[OFF-UK] Found ${results.length} UK results for: ${query}`);
    return results;
  } catch (error) {
    console.error('[OFF-UK] Error:', error);
    return [];
  }
}

async function lookupOpenFoodFactsUK(query: string): Promise<NutritionData | null> {
  const results = await searchOpenFoodFactsUK(query, 1);
  if (results.length === 0) return null;

  const food = results[0];
  return {
    name: food.name,
    calories: food.caloriesPer100g,
    protein: Math.round(food.proteinPer100g),
    carbs: Math.round(food.carbsPer100g),
    fats: Math.round(food.fatsPer100g),
    servingSize: food.defaultServingSize || 100,
    servingUnit: 'g',
    source: 'openfoodfacts',
    nutritionSource: (food.nutritionSource || 'database_generic') as 'branded_verified' | 'barcode_verified' | 'database_generic' | 'estimate',
    confidence: 'high',
    confidenceScore: food.confidenceScore || 0.85,
    brandName: food.brandName,
  };
}

// ============================================
// FOODREPO - Swiss/EU database for packaged products
// ============================================

async function searchFoodRepo(query: string, limit: number = 3): Promise<NutritionPer100g[]> {
  try {
    console.log(`[FoodRepo] Searching for: ${query}`);
    const encodedQuery = encodeURIComponent(query);
    const response = await fetchWithTimeout(
      `https://www.foodrepo.org/api/v3/products?q=${encodedQuery}&page_size=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Token token=""',
        },
      },
      5000
    );

    if (!response.ok) return [];

    const data = await response.json();
    const products = data?.data || [];
    if (products.length === 0) return [];

    const results: NutritionPer100g[] = [];
    for (const product of products.slice(0, limit)) {
      const nutrients = product.attributes?.nutrients || {};
      const nameData = product.attributes?.display_name_translations;
      const productName = nameData?.en || nameData?.de || nameData?.fr || query;

      const calories = nutrients?.['energy-kcal']?.per_hundred || nutrients?.energy?.per_hundred || 0;
      const protein = nutrients?.protein?.per_hundred || 0;
      const carbs = nutrients?.carbohydrates?.per_hundred || 0;
      const fats = nutrients?.fat?.per_hundred || 0;

      if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
        results.push({
          name: productName,
          caloriesPer100g: Math.round(calories),
          proteinPer100g: Math.round(protein * 10) / 10,
          carbsPer100g: Math.round(carbs * 10) / 10,
          fatsPer100g: Math.round(fats * 10) / 10,
          defaultServingSize: 100,
          source: 'foodrepo' as const,
          nutritionSource: 'database_generic',
          confidenceScore: 0.85,
        });
      }
    }

    console.log(`[FoodRepo] Found ${results.length} results for: ${query}`);
    return results;
  } catch (error) {
    console.error('[FoodRepo] Error:', error);
    return [];
  }
}

async function lookupFoodRepo(query: string): Promise<NutritionData | null> {
  const results = await searchFoodRepo(query, 1);
  if (results.length === 0) return null;

  const food = results[0];
  return {
    name: food.name,
    calories: food.caloriesPer100g,
    protein: Math.round(food.proteinPer100g),
    carbs: Math.round(food.carbsPer100g),
    fats: Math.round(food.fatsPer100g),
    servingSize: 100,
    servingUnit: 'g',
    source: 'foodrepo',
    nutritionSource: 'database_generic',
    confidence: 'high',
    confidenceScore: 0.85,
  };
}

// ============================================
// Open Food Facts Barcode Lookup (for barcode flow)
// ============================================
async function lookupBarcode(barcode: string): Promise<NutritionData | null> {
  try {
    console.log(`[OpenFoodFacts] Looking up barcode: ${barcode}`);
    
    const response = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: {
          'User-Agent': 'CJTNutrition - Nutrition Tracking App - contact@cjtnutrition.com'
        }
      },
      5000
    );

    if (!response.ok) {
      console.log(`[OpenFoodFacts] HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      console.log(`[OpenFoodFacts] Product not found for barcode: ${barcode}`);
      return null;
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    // Get nutrition per 100g
    const calories = nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0;
    const protein = nutriments.proteins_100g ?? nutriments.proteins ?? 0;
    const carbs = nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? 0;
    const fats = nutriments.fat_100g ?? nutriments.fat ?? 0;

    if (calories === 0 && protein === 0 && carbs === 0 && fats === 0) {
      console.log(`[OpenFoodFacts] No nutrition data for barcode: ${barcode}`);
      return null;
    }

    const productName = product.product_name || product.product_name_en || 'Unknown Product';
    const brandName = product.brands || undefined;
    const servingSize = parseFloat(product.serving_quantity) || 100;

    console.log(`[OpenFoodFacts] Found: ${productName} (${brandName || 'no brand'})`);

    return {
      name: brandName ? `${brandName} ${productName}` : productName,
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
      servingSize,
      servingUnit: 'g',
      source: 'open_food_facts',
      nutritionSource: brandName ? 'barcode_verified' as const : 'database_generic' as const,
      confidence: 'high',
      confidenceScore: brandName ? 0.95 : 0.85,
      brandName,
      imageUrl: product.image_url || undefined
    };
  } catch (error) {
    console.error('[OpenFoodFacts] Error:', error);
    return null;
  }
}

// USDA FoodData Central - For whole foods
async function searchUSDA(query: string, limit: number = 5): Promise<NutritionPer100g[]> {
  try {
    console.log(`[USDA] Searching for: ${query}`);
    
    // Use DEMO_KEY for basic access (rate limited but free)
    const apiKey = 'DEMO_KEY';
    const encodedQuery = encodeURIComponent(query);
    const response = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodedQuery}&pageSize=${limit}&dataType=Foundation,SR%20Legacy`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      },
      5000
    );

    if (!response.ok) {
      console.log(`[USDA] HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.foods || data.foods.length === 0) {
      console.log(`[USDA] No results for: ${query}`);
      return [];
    }

    const results: NutritionPer100g[] = [];

    for (const food of data.foods.slice(0, limit)) {
      const nutrients = food.foodNutrients || [];
      
      const findNutrient = (nutrientNumber: number): number => {
        const nutrient = nutrients.find((n: any) => n.nutrientNumber === String(nutrientNumber) || n.nutrientId === nutrientNumber);
        return nutrient?.value || 0;
      };

      // USDA nutrient IDs: 1008=Energy(kcal), 1003=Protein, 1005=Carbs, 1004=Fat
      const calories = findNutrient(1008) || findNutrient(208);
      const protein = findNutrient(1003) || findNutrient(203);
      const carbs = findNutrient(1005) || findNutrient(205);
      const fats = findNutrient(1004) || findNutrient(204);

      if (calories > 0 || protein > 0 || carbs > 0 || fats > 0) {
        results.push({
          name: food.description || food.lowercaseDescription || query,
          caloriesPer100g: Math.round(calories),
          proteinPer100g: Math.round(protein * 10) / 10,
          carbsPer100g: Math.round(carbs * 10) / 10,
          fatsPer100g: Math.round(fats * 10) / 10,
          defaultServingSize: 100,
          source: 'usda'
        });
      }
    }

    console.log(`[USDA] Found ${results.length} results for: ${query}`);
    return results;
  } catch (error) {
    console.error('[USDA] Error:', error);
    return [];
  }
}

async function lookupUSDA(query: string): Promise<NutritionData | null> {
  const results = await searchUSDA(query, 1);
  
  if (results.length === 0) {
    return null;
  }

  const food = results[0];
  return {
    name: food.name,
    calories: food.caloriesPer100g,
    protein: Math.round(food.proteinPer100g),
    carbs: Math.round(food.carbsPer100g),
    fats: Math.round(food.fatsPer100g),
    servingSize: 100,
    servingUnit: 'g',
    source: 'usda',
    nutritionSource: 'database_generic' as const,
    confidence: 'high',
    confidenceScore: 0.85,
  };
}

// ============================================
// FATSECRET LOOKUP (via edge function proxy)
// ============================================

async function lookupFatSecret(query: string): Promise<NutritionData | null> {
  try {
    console.log(`[FatSecret] Looking up: ${query}`);
    const clientId = Deno.env.get('FATSECRET_CLIENT_ID');
    const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      console.log('[FatSecret] Credentials not configured, skipping');
      return null;
    }

    // Inline token fetch to avoid cross-function calls
    const tokenResponse = await fetchWithTimeout('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: 'grant_type=client_credentials',
    }, 5000);

    if (!tokenResponse.ok) {
      console.error('[FatSecret] Token error:', tokenResponse.status);
      return null;
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    // Search foods
    const params = new URLSearchParams({
      method: 'foods.search',
      search_expression: query,
      format: 'json',
      max_results: '3',
    });

    const searchResponse = await fetchWithTimeout(`https://platform.fatsecret.com/rest/server.api?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }, 5000);

    if (!searchResponse.ok) {
      console.error('[FatSecret] Search error:', searchResponse.status);
      return null;
    }

    const searchData = await searchResponse.json();
    const foods = searchData?.foods?.food;
    if (!foods) {
      console.log('[FatSecret] No results for:', query);
      return null;
    }

    const foodList = Array.isArray(foods) ? foods : [foods];
    const topFood = foodList[0];
    if (!topFood) return null;

    // Parse description: "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 8.00g"
    const desc = topFood.food_description || '';
    const calMatch = desc.match(/Calories:\s*([\d.]+)/);
    const fatMatch = desc.match(/Fat:\s*([\d.]+)/);
    const carbMatch = desc.match(/Carbs:\s*([\d.]+)/);
    const protMatch = desc.match(/Protein:\s*([\d.]+)/);
    const servingMatch = desc.match(/^Per\s+(.+?)\s*-/);

    const calories = parseFloat(calMatch?.[1] || '0');
    const protein = parseFloat(protMatch?.[1] || '0');
    const carbs = parseFloat(carbMatch?.[1] || '0');
    const fats = parseFloat(fatMatch?.[1] || '0');

    if (calories === 0 && protein === 0 && carbs === 0 && fats === 0) {
      return null;
    }

    const foodName = topFood.brand_name
      ? `${topFood.brand_name} ${topFood.food_name}`
      : topFood.food_name;

    console.log(`[FatSecret] Found: ${foodName} (${calories} kcal)`);

    return {
      name: foodName,
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fats: Math.round(fats),
      servingSize: 100,
      servingUnit: 'g',
      source: 'fatsecret',
      nutritionSource: topFood.brand_name ? 'branded_verified' : 'database_generic',
      confidence: 'high',
      confidenceScore: 0.9,
      brandName: topFood.brand_name || undefined,
      sourceMetadata: {
        fatsecret_food_id: topFood.food_id,
        serving_description: servingMatch?.[1] || 'per serving',
        food_type: topFood.food_type,
      },
    };
  } catch (error) {
    console.error('[FatSecret] Error:', error);
    return null;
  }
}

// Input validation schema
const userDietContextSchema = z.object({
  dietType: z.string().max(50).optional(),
  allergies: z.array(z.string().max(100)).max(20).optional(),
  foodDislikes: z.string().max(500).optional()
}).optional();

const requestSchema = z.object({
  imageBase64: z.string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)")
    .refine(
      (val) => !val || val.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)),
      "Invalid image format"
    )
    .optional(),
  searchQuery: z.string()
    .max(500, "Search query too long")
    .optional(),
  mode: z.enum(['suggestions', 'calculate', 'analyze', 'parse_meal', 'barcode']).optional(),
  userDietContext: userDietContextSchema
}).refine(
  (data) => data.imageBase64 || data.searchQuery,
  "Either imageBase64 or searchQuery is required"
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Authenticated user:", user.id);

    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => e.message).join(", ")
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, searchQuery, mode, userDietContext } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ============================================
    // BARCODE MODE - OFF (world) → FoodRepo → AI fallback
    // ============================================
    if (mode === 'barcode' && searchQuery) {
      const barcodeMatch = searchQuery.match(/\d{8,14}/);
      const barcode = barcodeMatch ? barcodeMatch[0] : searchQuery.trim();
      
      console.log(`[Barcode Mode] Looking up: ${barcode}`);
      
      // Try Open Food Facts first (world database for barcodes)
      const offResult = await lookupBarcode(barcode);
      
      if (offResult) {
        console.log(`[Barcode Mode] Found in Open Food Facts: ${offResult.name}`);
        return new Response(
          JSON.stringify({
            name: offResult.name,
            calories: offResult.calories,
            protein: offResult.protein,
            carbs: offResult.carbs,
            fats: offResult.fats,
            caloriesPer100g: offResult.calories,
            proteinPer100g: offResult.protein,
            carbsPer100g: offResult.carbs,
            fatsPer100g: offResult.fats,
            defaultServingSize: offResult.servingSize || 100,
            confidence: 'high',
            confidenceScore: offResult.confidenceScore,
            source: 'openfoodfacts',
            nutritionSource: offResult.nutritionSource,
            requiresConfirmation: false,
            notes: `Source: OpenFoodFacts${offResult.brandName ? ` (${offResult.brandName})` : ''}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fallback to FoodRepo for barcode
      const frResult = await lookupFoodRepo(barcode);
      if (frResult) {
        console.log(`[Barcode Mode] Found in FoodRepo: ${frResult.name}`);
        return new Response(
          JSON.stringify({
            name: frResult.name,
            calories: frResult.calories,
            protein: frResult.protein,
            carbs: frResult.carbs,
            fats: frResult.fats,
            caloriesPer100g: frResult.calories,
            proteinPer100g: frResult.protein,
            carbsPer100g: frResult.carbs,
            fatsPer100g: frResult.fats,
            defaultServingSize: 100,
            confidence: 'high',
            confidenceScore: frResult.confidenceScore,
            source: 'foodrepo',
            nutritionSource: frResult.nutritionSource,
            requiresConfirmation: false,
            notes: `Source: FoodRepo`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[Barcode Mode] Not found in OFF or FoodRepo, falling back to AI`);
    }

    // ============================================
    // SUGGESTIONS MODE - OFF (UK) → FoodRepo → FatSecret → USDA → AI
    // ============================================
    if (mode === 'suggestions' && searchQuery) {
      console.log(`[Suggestions Mode] UK-first search for: ${searchQuery}`);
      
      // Search UK OFF, FoodRepo, FatSecret, and USDA in parallel
      const [offUKResults, frResults, fsResult, usdaResults] = await Promise.all([
        searchOpenFoodFactsUK(searchQuery, 4),
        searchFoodRepo(searchQuery, 3),
        lookupFatSecret(searchQuery),
        searchUSDA(searchQuery, 3),
      ]);
      
      // Merge: OFF (UK) → FoodRepo → FatSecret → USDA (deduplicated)
      const allResults: NutritionPer100g[] = [];
      const seenNames = new Set<string>();
      
      // OFF UK results first (highest UK relevance)
      for (const r of offUKResults) {
        const key = r.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allResults.push(r);
        }
      }
      
      // FoodRepo results
      for (const r of frResults) {
        const key = r.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allResults.push(r);
        }
      }
      
      // Add FatSecret result
      if (fsResult) {
        const key = fsResult.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allResults.push({
            name: fsResult.name,
            caloriesPer100g: fsResult.calories,
            proteinPer100g: fsResult.protein,
            carbsPer100g: fsResult.carbs,
            fatsPer100g: fsResult.fats,
            defaultServingSize: fsResult.servingSize || 100,
            source: 'fatsecret',
            nutritionSource: fsResult.nutritionSource,
            confidenceScore: 0.9,
            brandName: fsResult.brandName,
          });
        }
      }
      
      // USDA results last
      for (const r of usdaResults) {
        const key = r.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allResults.push(r);
        }
      }
      
      if (allResults.length > 0) {
        console.log(`[Suggestions Mode] Found ${allResults.length} total (OFF-UK: ${offUKResults.length}, FoodRepo: ${frResults.length}, FatSecret: ${fsResult ? 1 : 0}, USDA: ${usdaResults.length})`);
        return new Response(
          JSON.stringify({ 
            suggestions: allResults.slice(0, 6)
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log(`[Suggestions Mode] No database results, falling back to AI`);
    }

    // ============================================
    // CALCULATE MODE - OFF (UK) → FoodRepo → FatSecret → USDA → AI
    // ============================================
    if (mode === 'calculate' && searchQuery) {
      const weightMatch = searchQuery.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(?:of\s+)?(.+)/i);
      
      if (weightMatch) {
        const grams = parseFloat(weightMatch[1]);
        const foodName = weightMatch[2].trim();
        
        console.log(`[Calculate Mode] Looking up ${grams}g of ${foodName}`);
        
        // UK-first cascade: OFF (UK) → FoodRepo → FatSecret → USDA
        let result = await lookupOpenFoodFactsUK(foodName);
        let sourceLabel = 'OpenFoodFacts (UK)';
        
        if (!result) {
          result = await lookupFoodRepo(foodName);
          sourceLabel = 'FoodRepo';
        }
        
        if (!result) {
          result = await lookupFatSecret(foodName);
          sourceLabel = 'FatSecret';
        }
        
        if (!result) {
          result = await lookupUSDA(foodName);
          sourceLabel = 'USDA FoodData Central';
        }
        
        if (result) {
          const factor = grams / 100;
          console.log(`[Calculate Mode] Found in ${result.source}, calculating for ${grams}g`);
          
          return new Response(
            JSON.stringify({
              name: `${grams}g ${result.name}`,
              calories: Math.round(result.calories * factor),
              protein: Math.round(result.protein * factor),
              carbs: Math.round(result.carbs * factor),
              fats: Math.round(result.fats * factor),
              confidence: 'high',
              source: result.source,
              notes: `Calculated from ${sourceLabel} (${result.calories} kcal/100g)`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      console.log(`[Calculate Mode] Falling back to AI`);
    }

    // ============================================
    // DEFAULT/ANALYZE MODE - OFF (UK) → FoodRepo → FatSecret → USDA → AI
    // ============================================
    if (searchQuery && !imageBase64 && !mode) {
      const isSimpleQuery = searchQuery.split(/\s+/).length <= 4 && !searchQuery.includes(',');
      
      if (isSimpleQuery) {
        console.log(`[Analyze Mode] UK-first lookup for: ${searchQuery}`);
        
        // UK-first cascade
        let result = await lookupOpenFoodFactsUK(searchQuery);
        let sourceLabel = 'OpenFoodFacts (UK)';
        
        if (!result) {
          result = await lookupFoodRepo(searchQuery);
          sourceLabel = 'FoodRepo';
        }
        
        if (!result) {
          result = await lookupFatSecret(searchQuery);
          sourceLabel = 'FatSecret';
        }
        
        if (!result) {
          result = await lookupUSDA(searchQuery);
          sourceLabel = 'USDA FoodData Central';
        }
        
        if (result) {
          console.log(`[Analyze Mode] Found in ${result.source}: ${result.name}`);
          return new Response(
            JSON.stringify({
              name: result.name,
              calories: result.calories,
              protein: result.protein,
              carbs: result.carbs,
              fats: result.fats,
              confidence: 'high',
              confidenceScore: result.confidenceScore,
              source: result.source,
              nutritionSource: result.nutritionSource,
              requiresConfirmation: false,
              notes: `Source: ${sourceLabel} (per 100g serving)`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ============================================
    // CHAIN RESTAURANT DETECTION - Try branded lookup first
    // ============================================
    const chainDetection = detectChainRestaurant(searchQuery || '');
    if (chainDetection.isChain) {
      console.log(`[Chain Detection] Detected chain restaurant: ${chainDetection.chainName}`);
      // For chain restaurants, we'll use AI but mark as requiring confirmation
      // since we can't verify against official nutrition data
    }

    // ============================================
    // AI FALLBACK - For complex queries, images, or when databases fail
    // ============================================
    console.log(`[AI Fallback] Using AI for analysis, mode: ${mode || 'analyze'}`);

    // Build dietary context for warnings
    let dietaryContextNote = '';
    if (userDietContext) {
      const parts = [];
      if (userDietContext.dietType && userDietContext.dietType !== 'balanced') {
        const dietLabels: Record<string, string> = {
          'vegetarian': 'vegetarian (no meat/fish)',
          'vegan': 'vegan (no animal products)',
          'pescatarian': 'pescatarian (no meat)',
          'keto': 'keto (very low carb)',
          'paleo': 'paleo (no grains/legumes/dairy)',
          'gluten_free': 'gluten-free',
          'dairy_free': 'dairy-free',
          'low_carb': 'low-carb'
        };
        parts.push(`Diet: ${dietLabels[userDietContext.dietType] || userDietContext.dietType}`);
      }
      if (userDietContext.allergies && userDietContext.allergies.length > 0) {
        parts.push(`Allergies: ${userDietContext.allergies.join(', ')}`);
      }
      if (parts.length > 0) {
        dietaryContextNote = `\n\nUSER DIETARY CONTEXT: ${parts.join('. ')}. 
In the "notes" field, include a warning if any identified food doesn't match the user's diet or contains allergens.
For example: "⚠️ Warning: This meal contains chicken which doesn't fit a vegetarian diet."`;
      }
    }

    let messages: any[];
    
    if (imageBase64) {
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that analyzes food images to identify individual ingredients and estimate nutritional content.

When analyzing a food image, identify each distinct food item visible and provide nutritional data per 100g for each.
You MUST respond with ONLY a JSON object in this exact format:
{
  "mealName": "Overall meal name",
  "ingredients": [
    {
      "name": "Ingredient name",
      "estimatedGrams": number (estimated amount in grams based on visual size),
      "caloriesPer100g": number,
      "proteinPer100g": number,
      "carbsPer100g": number,
      "fatsPer100g": number
    }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": "Brief notes about the estimation"
}

Be thorough - identify all visible food items separately.
Estimate realistic portion sizes based on visual assessment.
If you can't identify the food clearly, make your best estimate and set confidence to "low".${dietaryContextNote}
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this food image and identify each individual ingredient with nutritional information."
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ];
    } else if (searchQuery && mode === 'suggestions') {
      messages = [
        {
          role: "system",
          content: `You are a nutrition database AI. When given a partial food name, suggest up to 5 matching foods with their nutritional content per 100 grams.

You MUST respond with ONLY a JSON object in this exact format:
{
  "suggestions": [
    {
      "name": "Food name",
      "caloriesPer100g": number,
      "proteinPer100g": number,
      "carbsPer100g": number,
      "fatsPer100g": number,
      "defaultServingSize": number (typical serving in grams),
      "source": "ai_estimation"
    }
  ]
}

Include common foods, branded items when recognizable, and variations.
Sort by relevance to the search query.
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Suggest foods matching: "${searchQuery}"`
        }
      ];
    } else if (searchQuery && mode === 'calculate') {
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that calculates precise nutritional content based on food weight.

When given a food with weight in grams, calculate the exact nutritional values.
You MUST respond with ONLY a JSON object in this exact format:
{
  "name": "Food name with weight",
  "calories": number (total calories for this amount),
  "protein": number (grams of protein),
  "carbs": number (grams of carbohydrates),
  "fats": number (grams of fat),
  "confidence": "medium",
  "source": "ai_estimation",
  "notes": "Brief notes about the calculation"
}

Use accurate nutritional data. Round to whole numbers.
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Calculate nutrition for: ${searchQuery}`
        }
      ];
    } else if (searchQuery && (mode === 'barcode' || searchQuery.includes('barcode'))) {
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI. A barcode was scanned but not found in food databases.
Try to identify the product and provide nutritional estimates per 100g serving.

You MUST respond with ONLY a JSON object in this exact format:
{
  "name": "Product name (best guess)",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "caloriesPer100g": number,
  "proteinPer100g": number,
  "carbsPer100g": number,
  "fatsPer100g": number,
  "defaultServingSize": 100,
  "confidence": "low",
  "source": "ai_estimation",
  "notes": "Product not found in database - these are estimated values. Try searching by product name for better accuracy."
}

Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `A barcode was scanned: ${searchQuery}. Please provide your best estimate for this product's nutritional information.`
        }
      ];
    } else if (searchQuery && mode === 'parse_meal') {
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that parses meal descriptions into individual ingredients with nutritional content.

When given a meal description, identify each distinct food item and provide nutritional data per 100g for each.

CRITICAL MEASUREMENT RULES:
1. If user provides EXACT gram measurements (e.g., "200g chicken"), use those EXACT amounts in "estimatedGrams". Do NOT round or change them.

2. For QUANTITY-BASED ITEMS (eggs, apples, bananas, oranges, slices of bread, etc.):
   - If user says "2 eggs" → keep as quantity, set estimatedGrams to weight of 2 eggs (≈100g), set "quantity": 2, "unit": "eggs"
   - If user says "1 apple" → keep as quantity, set estimatedGrams to weight of 1 medium apple (≈180g), set "quantity": 1, "unit": "apple"
   - If user says "1 banana" → keep as quantity, set estimatedGrams to weight of 1 medium banana (≈120g), set "quantity": 1, "unit": "banana"
   - ONLY convert to grams if user specifically says "Xg of eggs" or similar

3. Conversion rules for other measurements:
   - "X cups" → convert to grams (1 cup rice ≈ 185g, 1 cup milk ≈ 244g, etc.)
   - "X oz" → convert to grams (1 oz ≈ 28g)
   - "X ml" for liquids → use X as estimatedGrams
   - ONLY estimate if user does NOT provide any measurement

You MUST respond with ONLY a JSON object in this exact format:
{
  "mealName": "Overall meal name",
  "ingredients": [
    {
      "name": "Ingredient name",
      "estimatedGrams": number (total weight in grams for nutrition calculation),
      "quantity": number (optional - for countable items like eggs, fruits),
      "unit": string (optional - "eggs", "apple", "banana", "slice", etc.),
      "caloriesPer100g": number,
      "proteinPer100g": number,
      "carbsPer100g": number,
      "fatsPer100g": number,
      "userProvided": boolean (true if user gave exact measurement, false if estimated)
    }
  ],
  "confidence": "high" | "medium" | "low",
  "notes": "Brief notes about the estimation"
}

Be thorough - include all identifiable ingredients.
When user provides exact amounts, set confidence to "high" for those items.${dietaryContextNote}
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Parse this meal into individual ingredients. For countable items (eggs, fruits, slices), preserve the quantity. Only use grams if the user specifically mentioned grams: ${searchQuery}`
        }
      ];
    } else if (searchQuery) {
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that estimates nutritional content for foods.
          
When given a food name or description, you MUST respond with ONLY a JSON object in this exact format:
{
  "name": "Name of the food/dish",
  "calories": number (total estimated calories for a typical serving),
  "protein": number (grams of protein),
  "carbs": number (grams of carbohydrates),
  "fats": number (grams of fat),
  "confidence": "medium",
  "source": "ai_estimation",
  "notes": "Brief notes about typical serving size assumed"
}

Use accurate nutritional data for common foods. For complex dishes, estimate based on typical ingredients and portions.
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Please provide the nutritional information for: ${searchQuery}`
        }
      ];
    } else {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or searchQuery is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Lovable AI for food analysis");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response received");

    let nutritionData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      if (mode === 'suggestions') {
        nutritionData = { suggestions: [] };
      } else {
        nutritionData = {
          name: searchQuery || "Unknown Food",
          calories: 200,
          protein: 10,
          carbs: 20,
          fats: 8,
          confidence: "low",
          confidenceScore: 0.3,
          source: "ai_estimation",
          nutritionSource: "estimate",
          requiresConfirmation: true,
          notes: "Could not analyze accurately. These are estimated values."
        };
      }
    }

    // Add provenance tracking to AI responses
    const chainDetectionResult = detectChainRestaurant(searchQuery || '');
    const isEstimate = !nutritionData.source || nutritionData.source === 'ai_estimation';
    
    if (isEstimate && !nutritionData.nutritionSource) {
      nutritionData.nutritionSource = 'estimate';
      nutritionData.confidenceScore = nutritionData.confidenceScore ?? 0.5;
      nutritionData.requiresConfirmation = nutritionData.confidenceScore < 0.7;
      
      // Mark chain restaurant items specially
      if (chainDetectionResult.isChain) {
        nutritionData.isChainRestaurant = true;
        nutritionData.brandName = chainDetectionResult.chainName;
        nutritionData.notes = `⚠️ This is a ${chainDetectionResult.chainName} item. Nutrition values are estimates - actual values may vary. ${nutritionData.notes || ''}`.trim();
        nutritionData.requiresConfirmation = true; // Always require confirmation for chain items
      }
    }

    return new Response(
      JSON.stringify(nutritionData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-food function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
