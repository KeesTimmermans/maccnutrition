import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const userContextSchema = z.object({
  primaryGoal: z.string().max(100).nullable().optional(),
  targetCalories: z.number().min(500).max(10000).nullable().optional(),
  proteinGrams: z.number().min(0).max(500).nullable().optional(),
  carbsGrams: z.number().min(0).max(1000).nullable().optional(),
  fatsGrams: z.number().min(0).max(500).nullable().optional(),
  dietType: z.string().max(50).nullable().optional(),
  allergies: z.array(z.string().max(100)).max(20).nullable().optional(),
  foodDislikes: z.string().max(500).nullable().optional(),
  mealsPerDay: z.string().max(10).nullable().optional(),
  activityLevel: z.string().max(50).nullable().optional(),
  proteinShakesPreference: z.string().max(50).nullable().optional(),
  cookingSkill: z.string().max(50).nullable().optional(),
  mealPrepTime: z.string().max(50).nullable().optional(),
  eatingOutFrequency: z.string().max(50).nullable().optional(),
  snackingHabits: z.string().max(100).nullable().optional(),
  weekendHabits: z.string().max(100).nullable().optional(),
  energyPatterns: z.string().max(100).nullable().optional(),
  conditions: z.array(z.string().max(100)).max(20).nullable().optional(),
  unitSystem: z.enum(['metric', 'imperial']).nullable().optional()
}).passthrough().optional();

const requestSchema = z.object({
  userContext: userContextSchema
});

// Timing helper
function timer() {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    log: (label: string) => {
      const ms = Date.now() - start;
      console.log(`[TIMING] ${label}: ${ms}ms`);
      return ms;
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const totalTimer = timer();

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    totalTimer.log("auth_complete");

    // Validate input
    const rawBody = await req.json();
    const validationResult = requestSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid input", 
        details: validationResult.error.errors.map(e => e.message).join(", ")
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { userContext } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    totalTimer.log("validation_complete");

    // Parse context
    const mealsPerDayRaw = userContext?.mealsPerDay || '3';
    const mealsPerDayNum = parseInt(mealsPerDayRaw.replace(/\D/g, ''), 10) || 3;
    const targetCal = userContext?.targetCalories || 2000;
    const proteinG = userContext?.proteinGrams || 120;
    const carbsG = userContext?.carbsGrams || 200;
    const fatsG = userContext?.fatsGrams || 65;
    const dietType = userContext?.dietType || 'balanced';
    const allergies = userContext?.allergies || [];
    const foodDislikes = userContext?.foodDislikes || '';
    const isImperial = (userContext?.unitSystem || 'metric') === 'imperial';
    const proteinShakesPref = userContext?.proteinShakesPreference || 'sometimes';

    // Meal structure
    const mealStructures: Record<number, string[]> = {
      2: ['Brunch', 'Dinner'],
      3: ['Breakfast', 'Lunch', 'Dinner'],
      4: ['Breakfast', 'Lunch', 'Snack', 'Dinner'],
      5: ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner'],
      6: ['Breakfast', 'Snack', 'Lunch', 'Snack', 'Dinner', 'Snack'],
    };
    const allowedMealTypes = mealStructures[mealsPerDayNum] || mealStructures[3];

    // Diet rules (compact)
    const dietRules: Record<string, string> = {
      'vegetarian': 'VEGETARIAN: No meat/poultry/fish. Use plant proteins, eggs, dairy.',
      'vegan': 'VEGAN: No animal products at all. Plant-based only.',
      'pescatarian': 'PESCATARIAN: No meat/poultry. Fish, eggs, dairy OK.',
      'keto': 'KETO: Under 30g net carbs/day. High fat, moderate protein.',
      'paleo': 'PALEO: No grains, legumes, dairy, refined sugar.',
      'mediterranean': 'MEDITERRANEAN: Olive oil, fish, whole grains, vegetables.',
      'gluten_free': 'GLUTEN-FREE: No wheat, barley, rye.',
      'dairy_free': 'DAIRY-FREE: No dairy products.',
      'low_carb': 'LOW CARB: Under 100g carbs/day.',
      'balanced': 'Balanced whole foods.',
    };

    // Protein shakes (compact)
    const shakeRules: Record<string, string> = {
      'love': 'Include 1-2 protein shakes/day.',
      'sometimes': 'Include 2-3 shakes/week.',
      'prefer_whole_foods': 'Minimize shakes, max 1/week.',
      'never': 'NO protein shakes/powder.',
    };

    // Prep time and cooking skill rules (compact)
    const prepTimeRules: Record<string, string> = {
      'quick': 'Every recipe must be ready in under 15 minutes active time, minimal steps, few ingredients, one-pan/one-pot or no-cook where possible.',
      'moderate': '15-30 minutes active prep is fine, moderate number of steps and ingredients.',
      'enjoy': '30-60 minutes active prep is fine, can include more involved recipes and techniques.',
      'batch': 'Prioritize recipes that batch/meal-prep well: make-ahead, freezer-friendly, and reheat well across the week, even if total cook time is longer since it is done once.',
    };
    const cookingSkillRules: Record<string, string> = {
      'beginner': 'Keep techniques simple: no advanced knife skills, no complex sauces, minimal multitasking, clear basic steps.',
      'intermediate': 'Normal home-cooking techniques are fine.',
      'advanced': 'More complex techniques and recipes are welcome if they suit the meal.',
    };

    // Build compact prompt
    const systemPrompt = `Expert meal planner. Create a 7-day meal plan.

Targets: ${targetCal}kcal, ${proteinG}g protein, ${carbsG}g carbs, ${fatsG}g fat/day.
Meals/day: ${mealsPerDayNum} (${allowedMealTypes.join(', ')})
Diet: ${dietRules[dietType] || dietRules['balanced']}
${allergies.length > 0 ? `Allergies (NEVER include): ${allergies.join(', ')}` : ''}
${foodDislikes ? `Avoid: ${foodDislikes}` : ''}
${shakeRules[proteinShakesPref] || ''}
Units: ${isImperial ? 'imperial (oz, cups, pcs)' : 'metric (g, ml, pcs)'}

Rules:
- EXACTLY ${mealsPerDayNum} meals per day, 7 days
- ~${Math.round(targetCal / mealsPerDayNum)}kcal per meal
- Vary protein sources
- Practical, easy meals
- Each ingredient needs: name, quantity, unit${isImperial ? ' (oz/cups/tbsp/pcs)' : ' (g/ml/pcs)'}, gramsPerUnit${isImperial ? ' (28.35 for oz)' : ' (1 for g)'}`;

    const userPrompt = `Generate 7-day plan. ${mealsPerDayNum} meals/day: ${allowedMealTypes.join(', ')}. ${isImperial ? 'Imperial' : 'Metric'} units.`;

    totalTimer.log("prompt_built");

    // AI call
    const aiTimer = timer();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_meal_plan",
              description: "Create a 7-day meal plan",
              parameters: {
                type: "object",
                properties: {
                  days: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        day: { type: "string" },
                        meals: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              type: { type: "string" },
                              name: { type: "string" },
                              description: { type: "string" },
                              calories: { type: "number" },
                              protein: { type: "number" },
                              carbs: { type: "number" },
                              fats: { type: "number" },
                              ingredients: {
                                type: "array",
                                items: {
                                  type: "object",
                                  properties: {
                                    name: { type: "string" },
                                    quantity: { type: "number" },
                                    unit: { type: "string" },
                                    gramsPerUnit: { type: "number" }
                                  },
                                  required: ["name", "quantity", "unit", "gramsPerUnit"]
                                }
                              }
                            },
                            required: ["type", "name", "calories", "protein", "carbs", "fats", "ingredients"]
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
                    description: "3 meal prep tips"
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

    aiTimer.log("ai_call_complete");

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    aiTimer.log("ai_response_parsed");

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const mealPlan = JSON.parse(toolCall.function.arguments);
      totalTimer.log("total_complete");
      console.log(`[PERF] Meal plan generated: ${mealPlan.days?.length} days, ${mealPlan.days?.[0]?.meals?.length} meals/day`);
      return new Response(JSON.stringify({ mealPlan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (content) {
      totalTimer.log("total_complete_fallback");
      return new Response(JSON.stringify({ rawContent: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate meal plan");

  } catch (error) {
    totalTimer.log("total_error");
    console.error("Error in generate-meal-plan function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
