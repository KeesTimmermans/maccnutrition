import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  source: 'open_food_facts' | 'usda' | 'ai_estimation';
  confidence: 'high' | 'medium' | 'low';
  brandName?: string;
  imageUrl?: string;
}

interface NutritionPer100g {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  defaultServingSize: number;
  source: 'open_food_facts' | 'usda' | 'ai_estimation';
  brandName?: string;
}

// Open Food Facts - For barcode lookups
async function lookupBarcode(barcode: string): Promise<NutritionData | null> {
  try {
    console.log(`[OpenFoodFacts] Looking up barcode: ${barcode}`);
    
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      {
        headers: {
          'User-Agent': 'CJTNutrition - Nutrition Tracking App - contact@cjtnutrition.com'
        }
      }
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
      confidence: 'high',
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
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodedQuery}&pageSize=${limit}&dataType=Foundation,SR%20Legacy`,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
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
    confidence: 'high'
  };
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
    // BARCODE MODE - Use Open Food Facts first
    // ============================================
    if (mode === 'barcode' && searchQuery) {
      // Extract barcode from the query (handles "barcode product: 123456789")
      const barcodeMatch = searchQuery.match(/\d{8,14}/);
      const barcode = barcodeMatch ? barcodeMatch[0] : searchQuery.trim();
      
      console.log(`[Barcode Mode] Looking up: ${barcode}`);
      
      // Try Open Food Facts first
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
            source: 'open_food_facts',
            notes: `Data from Open Food Facts database${offResult.brandName ? ` (${offResult.brandName})` : ''}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fallback to AI for unknown barcodes
      console.log(`[Barcode Mode] Not found in database, falling back to AI`);
    }

    // ============================================
    // SUGGESTIONS MODE - Use USDA first
    // ============================================
    if (mode === 'suggestions' && searchQuery) {
      console.log(`[Suggestions Mode] Searching USDA for: ${searchQuery}`);
      
      const usdaResults = await searchUSDA(searchQuery, 5);
      
      if (usdaResults.length > 0) {
        console.log(`[Suggestions Mode] Found ${usdaResults.length} USDA results`);
        return new Response(
          JSON.stringify({ 
            suggestions: usdaResults.map(r => ({
              ...r,
              source: 'usda'
            }))
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Fallback to AI for suggestions
      console.log(`[Suggestions Mode] No USDA results, falling back to AI`);
    }

    // ============================================
    // CALCULATE MODE - Try USDA first
    // ============================================
    if (mode === 'calculate' && searchQuery) {
      // Parse weight from query like "150g of chicken breast"
      const weightMatch = searchQuery.match(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\s+(?:of\s+)?(.+)/i);
      
      if (weightMatch) {
        const grams = parseFloat(weightMatch[1]);
        const foodName = weightMatch[2].trim();
        
        console.log(`[Calculate Mode] Looking up ${grams}g of ${foodName}`);
        
        const usdaResult = await lookupUSDA(foodName);
        
        if (usdaResult) {
          const factor = grams / 100;
          console.log(`[Calculate Mode] Found in USDA, calculating for ${grams}g`);
          
          return new Response(
            JSON.stringify({
              name: `${grams}g ${usdaResult.name}`,
              calories: Math.round(usdaResult.calories * factor),
              protein: Math.round(usdaResult.protein * factor),
              carbs: Math.round(usdaResult.carbs * factor),
              fats: Math.round(usdaResult.fats * factor),
              confidence: 'high',
              source: 'usda',
              notes: `Calculated from USDA FoodData Central (${usdaResult.calories} kcal/100g)`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      console.log(`[Calculate Mode] Falling back to AI`);
    }

    // ============================================
    // DEFAULT/ANALYZE MODE - Try USDA first for simple queries
    // ============================================
    if (searchQuery && !imageBase64 && !mode) {
      // Check if it's a simple food query (not a complex meal description)
      const isSimpleQuery = searchQuery.split(/\s+/).length <= 4 && !searchQuery.includes(',');
      
      if (isSimpleQuery) {
        console.log(`[Analyze Mode] Simple query, trying USDA first: ${searchQuery}`);
        
        const usdaResult = await lookupUSDA(searchQuery);
        
        if (usdaResult) {
          console.log(`[Analyze Mode] Found in USDA: ${usdaResult.name}`);
          return new Response(
            JSON.stringify({
              name: usdaResult.name,
              calories: usdaResult.calories,
              protein: usdaResult.protein,
              carbs: usdaResult.carbs,
              fats: usdaResult.fats,
              confidence: 'high',
              source: 'usda',
              notes: `Data from USDA FoodData Central (per 100g serving)`
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
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
          source: "ai_estimation",
          notes: "Could not analyze accurately. These are estimated values."
        };
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
