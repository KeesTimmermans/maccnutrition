import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const mealSchema = z.object({
  name: z.string().max(200),
  description: z.string().max(500)
}).passthrough();

const daySchema = z.object({
  day: z.string().max(20),
  meals: z.array(mealSchema).max(10)
}).passthrough();

const mealPlanSchema = z.object({
  days: z.array(daySchema).max(14, "Meal plan too long (max 14 days)")
}).passthrough();

const requestSchema = z.object({
  mealPlan: mealPlanSchema,
  currency: z.string().max(10).optional().default("USD"),
  householdSize: z.number().min(1).max(20).optional().default(1)
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

    const { mealPlan, currency, householdSize } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Currency symbol mapping
    const currencySymbols: Record<string, string> = {
      GBP: "£",
      USD: "$",
      EUR: "€",
      CAD: "C$",
      AUD: "A$",
    };
    const currencySymbol = currencySymbols[currency] || "$";

    // Extract all meals from the plan
    const allMeals = mealPlan.days.flatMap((day: any) => 
      day.meals.map((meal: any) => `${meal.name}: ${meal.description}`)
    ).join('\n');

    const systemPrompt = `You are an expert grocery planner. Analyze the meal plan and generate a consolidated grocery list with quantities. Group items by category and combine duplicate ingredients with total quantities needed for the week. IMPORTANT: All cost estimates must be in ${currency} (${currencySymbol}).`;

    const userPrompt = `Generate a grocery list for this weekly meal plan:

${allMeals}

Consolidate all ingredients, combine duplicates, and estimate quantities needed for ${householdSize === 1 ? 'one person' : `${householdSize} people`} for the whole week. Be practical with quantities (e.g., buy 1 dozen eggs instead of 7 eggs).

IMPORTANT: Provide the cost estimate in ${currency} using the ${currencySymbol} symbol.`;

    console.log("Generating grocery list with currency:", currency);

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
              name: "create_grocery_list",
              description: "Create a categorized grocery list with quantities",
              parameters: {
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Category name (Produce, Proteins, Dairy, Grains, Pantry, etc.)" },
                        icon: { type: "string", description: "Emoji icon for the category" },
                        items: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string", description: "Item name" },
                              quantity: { type: "string", description: "Amount needed (e.g., 2 lbs, 1 dozen, 500g)" },
                              notes: { type: "string", description: "Optional notes (e.g., fresh, organic)" }
                            },
                            required: ["name", "quantity"]
                          }
                        }
                      },
                      required: ["name", "icon", "items"]
                    }
                  },
                  estimatedCost: {
                    type: "string",
                    description: "Rough cost estimate for the groceries"
                  },
                  shoppingTips: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 money-saving or shopping tips"
                  }
                },
                required: ["categories", "estimatedCost", "shoppingTips"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_grocery_list" } }
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

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      const groceryList = JSON.parse(toolCall.function.arguments);
      
      // Ensure the estimated cost has the correct currency symbol
      if (groceryList.estimatedCost) {
        // Remove any existing currency symbols and normalize
        const numericCost = groceryList.estimatedCost.replace(/[£$€C$A$]/g, '').trim();
        groceryList.estimatedCost = `${currencySymbol}${numericCost}`;
      }
      
      console.log("Grocery list generated successfully with currency:", currency);
      return new Response(JSON.stringify({ groceryList }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to generate grocery list");

  } catch (error) {
    console.error("Error in generate-grocery-list function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
