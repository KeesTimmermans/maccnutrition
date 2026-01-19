import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // Parse meals per day to determine meal structure
    const mealsPerDayRaw = userContext?.mealsPerDay || '3';
    const mealsPerDayNum = parseInt(mealsPerDayRaw, 10) || 3;
    
    // Define meal structure based on number of meals
    let mealStructure = '';
    let allowedMealTypes: string[] = [];
    
    if (mealsPerDayNum === 2) {
      mealStructure = 'EXACTLY 2 meals per day: Brunch (mid-morning) and Dinner (evening). NO breakfast, lunch, or snacks.';
      allowedMealTypes = ['Brunch', 'Dinner'];
    } else if (mealsPerDayNum === 3) {
      mealStructure = 'EXACTLY 3 meals per day: Breakfast (morning), Lunch (midday), and Dinner (evening). NO snacks.';
      allowedMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    } else if (mealsPerDayNum === 4) {
      mealStructure = 'EXACTLY 4 meals per day: Breakfast (morning), Lunch (midday), Afternoon Snack, and Dinner (evening).';
      allowedMealTypes = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
    } else if (mealsPerDayNum === 5) {
      mealStructure = 'EXACTLY 5 meals per day: Breakfast (morning), Morning Snack, Lunch (midday), Afternoon Snack, and Dinner (evening).';
      allowedMealTypes = ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner'];
    } else if (mealsPerDayNum >= 6) {
      mealStructure = 'EXACTLY 6 meals per day: Breakfast, Morning Snack, Lunch, Afternoon Snack, Dinner, and Evening Snack.';
      allowedMealTypes = ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner', 'Snack'];
    } else {
      // Default to 3 meals
      mealStructure = 'EXACTLY 3 meals per day: Breakfast (morning), Lunch (midday), and Dinner (evening). NO snacks.';
      allowedMealTypes = ['Breakfast', 'Lunch', 'Dinner'];
    }

    console.log(`Generating meal plan with ${mealsPerDayNum} meals per day:`, mealStructure);

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
- Meals Per Day: ${mealsPerDayNum}
- Activity Level: ${userContext?.activityLevel || 'moderate'}

CRITICAL MEAL STRUCTURE REQUIREMENT:
${mealStructure}

You MUST provide EXACTLY ${mealsPerDayNum} meals for EACH of the 7 days. No more, no less.
The allowed meal types are: ${allowedMealTypes.join(', ')}.

Guidelines:
- Create balanced, whole-food focused meals
- Distribute the ${userContext?.targetCalories || 2000} daily calories evenly across ${mealsPerDayNum} meals (approximately ${Math.round((userContext?.targetCalories || 2000) / mealsPerDayNum)} kcal per meal)
- Ensure daily totals approximately match calorie and macro targets
- Vary protein sources throughout the week
- Include vegetables with most meals
- Keep meals practical and easy to prepare
- Respect dietary restrictions and allergies`;

    const userPrompt = `Generate a complete 7-day meal plan with EXACTLY ${mealsPerDayNum} meals per day. 

IMPORTANT: Each day MUST have exactly these meals: ${allowedMealTypes.join(', ')}.

Each meal should include name, estimated calories, protein, carbs, and fats. Make it varied and delicious while meeting the nutritional targets.

Remember: ${mealsPerDayNum} meals per day, no exceptions. If the user requested ${mealsPerDayNum} meals, do NOT add extra snacks or meals.`;

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
