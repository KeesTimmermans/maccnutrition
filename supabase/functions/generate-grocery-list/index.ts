import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mealPlan } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Extract all meals from the plan
    const allMeals = mealPlan.days.flatMap((day: any) => 
      day.meals.map((meal: any) => `${meal.name}: ${meal.description}`)
    ).join('\n');

    const systemPrompt = `You are an expert grocery planner. Analyze the meal plan and generate a consolidated grocery list with quantities. Group items by category and combine duplicate ingredients with total quantities needed for the week.`;

    const userPrompt = `Generate a grocery list for this weekly meal plan:

${allMeals}

Consolidate all ingredients, combine duplicates, and estimate quantities needed for one person for the whole week. Be practical with quantities (e.g., buy 1 dozen eggs instead of 7 eggs).`;

    console.log("Generating grocery list");

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
      console.log("Grocery list generated successfully");
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
