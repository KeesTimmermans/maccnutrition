import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const userContextSchema = z.object({
  primaryGoal: z.string().max(100).optional(),
  targetCalories: z.number().min(500).max(10000).optional(),
  proteinGrams: z.number().min(0).max(500).optional(),
  carbsGrams: z.number().min(0).max(1000).optional(),
  fatsGrams: z.number().min(0).max(500).optional(),
  dietType: z.string().max(50).optional(),
  allergies: z.array(z.string().max(100)).max(20).optional(),
  foodDislikes: z.string().max(500).optional(),
  mealsPerDay: z.string().max(10).optional(),
  activityLevel: z.string().max(50).optional()
}).passthrough().optional();

const requestSchema = z.object({
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

    const { userContext } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert meal planner for CJTNutrition. Create a personalized 7-day meal plan based on the user's goals, preferences, and dietary restrictions.

User Profile:
- Primary Goal: ${userContext?.primaryGoal || 'general health'}
- Daily Calorie Target: ${userContext?.targetCalories || 2000} kcal
- Protein Goal: ${userContext?.proteinGrams || 120}g
- Carbs Goal: ${userContext?.carbsGrams || 200}g
- Fats Goal: ${userContext?.fatsGrams || 65}g
- Diet Type: ${userContext?.dietType || 'balanced'}
- Allergies: ${userContext?.allergies?.join(', ') || 'none'}
- Food Dislikes: ${userContext?.foodDislikes || 'none'}
- Meals Per Day: ${userContext?.mealsPerDay || '3'}
- Activity Level: ${userContext?.activityLevel || 'moderate'}

Guidelines:
- Create balanced, whole-food focused meals
- Ensure daily totals approximately match calorie and macro targets
- Vary protein sources throughout the week
- Include vegetables with most meals
- Keep meals practical and easy to prepare
- Respect dietary restrictions and allergies
- Distribute macros evenly across meals`;

    const userPrompt = `Generate a complete 7-day meal plan with ${userContext?.mealsPerDay || '3'} meals per day. Each meal should include name, estimated calories, protein, carbs, and fats. Make it varied and delicious while meeting the nutritional targets.`;

    console.log("Generating meal plan for user");

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
              name: "create_meal_plan",
              description: "Create a structured 7-day meal plan",
              parameters: {
                type: "object",
                properties: {
                  days: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "string", description: "Day name (Monday, Tuesday, etc.)" },
                        meals: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              type: { type: "string", description: "Meal type (Breakfast, Lunch, Dinner, Snack)" },
                              name: { type: "string", description: "Meal name" },
                              description: { type: "string", description: "Brief description of ingredients" },
                              calories: { type: "number" },
                              protein: { type: "number" },
                              carbs: { type: "number" },
                              fats: { type: "number" }
                            },
                            required: ["type", "name", "description", "calories", "protein", "carbs", "fats"]
                          }
                        },
                        totals: {
                          type: "object",
                          properties: {
                            calories: { type: "number" },
                            protein: { type: "number" },
                            carbs: { type: "number" },
                            fats: { type: "number" }
                          },
                          required: ["calories", "protein", "carbs", "fats"]
                        }
                      },
                      required: ["day", "meals", "totals"]
                    }
                  },
                  tips: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 helpful meal prep tips"
                  }
                },
                required: ["days", "tips"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_meal_plan" } }
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
    console.log("AI response received");

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const mealPlan = JSON.parse(toolCall.function.arguments);
      console.log("Meal plan generated successfully");
      return new Response(JSON.stringify({ mealPlan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback if tool call didn't work
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      return new Response(JSON.stringify({ rawContent: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate meal plan");

  } catch (error) {
    console.error("Error in generate-meal-plan function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
