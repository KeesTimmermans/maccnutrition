import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const currentMealSchema = z.object({
  name: z.string().max(200, "Meal name too long"),
  type: z.string().max(50, "Meal type too long"),
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fats: z.number().min(0).max(1000)
}).passthrough();

const userContextSchema = z.object({
  dietType: z.string().max(50).optional(),
  allergies: z.array(z.string().max(100)).max(20).optional(),
  foodDislikes: z.string().max(500).optional()
}).passthrough().optional();

const requestSchema = z.object({
  currentMeal: currentMealSchema,
  userPreference: z.string().max(1000, "Preference description too long"),
  userContext: userContextSchema
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { currentMeal, userPreference, userContext } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert meal planner for CJTNutrition. The user wants to swap a meal in their plan.

Current Meal to Replace:
- Name: ${currentMeal.name}
- Type: ${currentMeal.type}
- Calories: ${currentMeal.calories}
- Protein: ${currentMeal.protein}g
- Carbs: ${currentMeal.carbs}g
- Fats: ${currentMeal.fats}g

User Profile:
- Diet Type: ${userContext?.dietType || 'balanced'}
- Allergies: ${userContext?.allergies?.join(', ') || 'none'}
- Food Dislikes: ${userContext?.foodDislikes || 'none'}

Guidelines:
- Provide an alternative meal that matches similar macro targets
- Respect dietary restrictions and allergies
- Consider the user's preference for the swap
- Keep the meal practical and easy to prepare`;

    const userPrompt = `The user says: "${userPreference}". Please suggest an alternative ${currentMeal.type} meal that addresses their preference while maintaining similar nutritional values.`;

    console.log("Swapping meal:", currentMeal.name);

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
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_meal_swap",
              description: "Suggest an alternative meal to replace the current one",
              parameters: {
                type: "object",
                properties: {
                  newMeal: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "Meal type (Breakfast, Lunch, Dinner, Snack)" },
                      name: { type: "string", description: "New meal name" },
                      description: { type: "string", description: "Brief description of ingredients" },
                      calories: { type: "number" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fats: { type: "number" }
                    },
                    required: ["type", "name", "description", "calories", "protein", "carbs", "fats"]
                  },
                  reason: { type: "string", description: "Brief explanation of why this swap works for the user" }
                },
                required: ["newMeal", "reason"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "suggest_meal_swap" } }
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
    console.log("AI response received for swap");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const swapResult = JSON.parse(toolCall.function.arguments);
      console.log("Meal swap generated successfully");
      return new Response(JSON.stringify(swapResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate meal swap");

  } catch (error) {
    console.error("Error in swap-meal function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
