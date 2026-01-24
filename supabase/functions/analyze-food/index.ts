import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  mode: z.enum(['suggestions', 'calculate', 'analyze', 'parse_meal']).optional(),
  userDietContext: userDietContextSchema
}).refine(
  (data) => data.imageBase64 || data.searchQuery,
  "Either imageBase64 or searchQuery is required"
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
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

    // Parse and validate input
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
      // Analyze food from image - parse into individual ingredients
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

Be thorough - identify all visible food items separately (e.g., for a plate with chicken, rice, and vegetables, list each separately).
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
      // Return food suggestions with per-100g nutrition
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
      "defaultServingSize": number (typical serving in grams)
    }
  ]
}

Include common foods, branded items when recognizable, and variations (e.g., "Chicken breast, raw", "Chicken breast, grilled").
Sort by relevance to the search query.
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Suggest foods matching: "${searchQuery}"`
        }
      ];
    } else if (searchQuery && mode === 'calculate') {
      // Calculate nutrition for specific weight
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
  "confidence": "high" | "medium" | "low",
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
    } else if (searchQuery && mode === 'parse_meal') {
      // Parse a meal description into individual ingredients
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

Be thorough - include all identifiable ingredients (e.g., for "eggs with toast and butter", list eggs, bread, and butter separately).
When user provides exact amounts, set confidence to "high" for those items.${dietaryContextNote}
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Parse this meal into individual ingredients. For countable items (eggs, fruits, slices), preserve the quantity. Only use grams if the user specifically mentioned grams: ${searchQuery}`
        }
      ];
    } else if (searchQuery) {
      // Default: estimate nutrition from text search
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
  "confidence": "high" | "medium" | "low",
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

    console.log("Calling Lovable AI for food analysis, mode:", mode || 'analyze');
    
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

    console.log("AI response:", content);

    // Parse the JSON response
    let nutritionData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a fallback response
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