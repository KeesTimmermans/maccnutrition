import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { captionText } = await req.json();
    
    if (!captionText || captionText.trim().length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a recipe caption with at least 10 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing recipe caption, length:', captionText.length);

    // Use AI to parse the recipe and estimate macros
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiPrompt = `You are a nutrition expert. Analyze this recipe text and extract recipe information with macro estimates.

RECIPE TEXT:
${captionText.substring(0, 4000)}

INSTRUCTIONS:
1. Identify if this contains recipe or food information
2. Extract the recipe name/dish name
3. List all ingredients mentioned (estimate quantities if not specified)
4. Calculate estimated macros per serving based on standard nutritional data

Respond with ONLY valid JSON in this exact format:
{
  "isRecipe": true/false,
  "recipeName": "Name of the dish",
  "servings": 1,
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": "amount with unit (e.g., '100g', '1 cup')",
      "estimatedGrams": 100,
      "calories": 150,
      "protein": 10,
      "carbs": 15,
      "fats": 5
    }
  ],
  "totalPerServing": {
    "calories": 500,
    "protein": 30,
    "carbs": 50,
    "fats": 20
  },
  "notes": "Any relevant notes about the recipe or estimates",
  "confidence": "high/medium/low"
}

If this is NOT a recipe or food-related text, return:
{
  "isRecipe": false,
  "error": "This text doesn't appear to contain a recipe"
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a nutrition expert that extracts recipe information and estimates macros. Always respond with valid JSON only." },
          { role: "user", content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error("Failed to analyze recipe");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    let recipeData;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiContent.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, aiContent];
      const jsonStr = jsonMatch[1] || aiContent;
      recipeData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not parse recipe information from this text.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipeData.isRecipe) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: recipeData.error || 'This text doesn\'t appear to contain a recipe.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully parsed recipe:', recipeData.recipeName);

    return new Response(
      JSON.stringify({
        success: true,
        recipe: {
          name: recipeData.recipeName,
          servings: recipeData.servings || 1,
          ingredients: recipeData.ingredients || [],
          totals: recipeData.totalPerServing || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fats: 0
          },
          notes: recipeData.notes || '',
          confidence: recipeData.confidence || 'medium'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error parsing recipe:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to parse recipe' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
