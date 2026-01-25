import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const ingredientSchema = z.object({
  name: z.string().max(200),
  quantity: z.number().min(0).max(10000),
  unit: z.string().max(20),
  gramsPerUnit: z.number().min(0).max(10000),
  caloriesPer100g: z.number().min(0).max(2000),
  proteinPer100g: z.number().min(0).max(100),
  carbsPer100g: z.number().min(0).max(100),
  fatsPer100g: z.number().min(0).max(100),
});

const userContextSchema = z.object({
  dietType: z.string().max(50).nullable().optional(),
  allergies: z.array(z.string().max(100)).max(20).nullable().optional(),
  foodDislikes: z.string().max(500).nullable().optional(),
  unitSystem: z.string().max(20).nullable().optional(),
}).passthrough().optional();

const requestSchema = z.object({
  currentIngredient: ingredientSchema,
  mealName: z.string().max(200),
  mealType: z.string().max(50),
  userPreference: z.string().max(500).nullable().optional(),
  userContext: userContextSchema,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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

    console.log("Authenticated user for ingredient swap:", user.id);

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(JSON.stringify({ 
        error: "Invalid input", 
        details: validationResult.error.errors.map(e => e.message).join(", ")
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { currentIngredient, mealName, mealType, userPreference, userContext } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build dietary restrictions
    const dietTypeRaw = userContext?.dietType || 'balanced';
    const allergiesRaw = userContext?.allergies || [];
    const foodDislikesRaw = userContext?.foodDislikes || '';
    const isImperial = userContext?.unitSystem === 'imperial';
    
    // Map diet types to strict exclusion rules
    const dietTypeRules: Record<string, string> = {
      'vegetarian': 'STRICT VEGETARIAN: NO meat (beef, pork, lamb, chicken, turkey, duck, poultry, fish, seafood). Only plant proteins, eggs, dairy.',
      'vegan': 'STRICT VEGAN: NO animal products (meat, fish, poultry, eggs, dairy, honey). Plant-based only.',
      'pescatarian': 'PESCATARIAN: NO meat (beef, pork, lamb, chicken, turkey, poultry). Fish/seafood, eggs, dairy allowed.',
      'keto': 'KETOGENIC: Very low carb (under 30g net carbs), high fat.',
      'paleo': 'PALEO: No grains, legumes, dairy, refined sugar, processed foods.',
      'gluten_free': 'GLUTEN-FREE: NO wheat, barley, rye, or gluten-containing ingredients.',
      'dairy_free': 'DAIRY-FREE: NO milk, cheese, yogurt, butter, cream, or dairy products.',
      'balanced': 'Balanced diet with a variety of whole foods.'
    };
    
    const dietTypeGuideline = dietTypeRules[dietTypeRaw] || dietTypeRules['balanced'];
    
    // Calculate current ingredient contribution
    const currentGrams = currentIngredient.quantity * currentIngredient.gramsPerUnit;
    const currentCals = Math.round(currentIngredient.caloriesPer100g * currentGrams / 100);
    const currentProtein = Math.round(currentIngredient.proteinPer100g * currentGrams / 100);

    const unitInstructions = isImperial
      ? 'Use imperial units: "oz" for weight, "cups" for volume, "tbsp" for smaller amounts, "pcs" for countable items.'
      : 'Use metric units: "g" for weight, "ml" for liquids, "pcs" for countable items.';

    const systemPrompt = `You are an expert ingredient substitution specialist for CJTNutrition.

The user wants to swap an ingredient in their ${mealType}: "${mealName}"

Current Ingredient to Replace:
- Name: ${currentIngredient.name}
- Amount: ${currentIngredient.quantity} ${currentIngredient.unit} (${currentGrams}g total)
- Contributes: ~${currentCals} cal, ${currentProtein}g protein

⚠️ CRITICAL DIETARY REQUIREMENTS:
${dietTypeGuideline}
${allergiesRaw.length > 0 ? `\nALLERGIES - NEVER INCLUDE: ${allergiesRaw.join(', ')}` : ''}
${foodDislikesRaw ? `\nDISLIKES - AVOID: ${foodDislikesRaw}` : ''}

Guidelines:
- Provide 3 DIVERSE alternative ingredients that work in this meal
- Match similar nutritional profile (calories, protein) when possible
- Consider the cooking context and meal compatibility
- Alternatives should be practical and commonly available
- ${unitInstructions}
- Include accurate nutrition data per 100g

${userPreference ? `User preference: "${userPreference}"` : 'Generate varied options (different food groups if possible)'}`;

    const userPrompt = `Please suggest 3 alternative ingredients to replace "${currentIngredient.name}" in ${mealName}. Make them diverse and suitable for this ${mealType}.`;

    console.log("Swapping ingredient:", currentIngredient.name, "in meal:", mealName);

    const ingredientOptionSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        quantity: { type: "number" },
        unit: { type: "string", description: isImperial ? "oz, cups, tbsp, or pcs" : "g, ml, or pcs" },
        gramsPerUnit: { type: "number", description: "Grams per unit for nutrition calculation" },
        caloriesPer100g: { type: "number" },
        proteinPer100g: { type: "number" },
        carbsPer100g: { type: "number" },
        fatsPer100g: { type: "number" },
        reason: { type: "string", description: "Brief reason why this is a good substitute" }
      },
      required: ["name", "quantity", "unit", "gramsPerUnit", "caloriesPer100g", "proteinPer100g", "carbsPer100g", "fatsPer100g", "reason"]
    };

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_ingredient_options",
          description: "Suggest 3 diverse alternative ingredients",
          parameters: {
            type: "object",
            properties: {
              options: {
                type: "array",
                items: ingredientOptionSchema,
                minItems: 3,
                maxItems: 3,
                description: "Array of 3 ingredient alternatives"
              }
            },
            required: ["options"]
          }
        }
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_ingredient_options" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received for ingredient swap");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const swapResult = JSON.parse(toolCall.function.arguments);
      console.log("Ingredient swap options generated:", swapResult.options?.length);
      
      return new Response(JSON.stringify({ options: swapResult.options }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate ingredient alternatives");

  } catch (error) {
    console.error("Error in swap-ingredient function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
