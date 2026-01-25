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

    const { instagramUrl } = await req.json();
    
    if (!instagramUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instagram URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Instagram URL
    const urlPattern = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+/i;
    if (!urlPattern.test(instagramUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Please provide a valid Instagram post or reel URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping Instagram URL:', instagramUrl);

    // Step 1: Use Firecrawl to scrape the Instagram post
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Instagram scraping not configured. Please connect Firecrawl.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: instagramUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not access Instagram post. The post may be private or unavailable.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const captionText = scrapeData.data?.markdown || scrapeData.markdown || '';
    
    if (!captionText || captionText.length < 20) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract caption from Instagram post. The post may not contain recipe information.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted caption length:', captionText.length);

    // Step 2: Use AI to parse the recipe and estimate macros
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiPrompt = `You are a nutrition expert. Analyze this Instagram post caption and extract recipe information with macro estimates.

INSTAGRAM CAPTION:
${captionText.substring(0, 4000)}

INSTRUCTIONS:
1. Identify if this is a recipe or food-related post
2. Extract the recipe name/dish name
3. List all ingredients mentioned (estimate quantities if not specified)
4. Calculate estimated macros per serving

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

If this is NOT a recipe post, return:
{
  "isRecipe": false,
  "error": "This post doesn't appear to contain a recipe"
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
          error: 'Could not parse recipe information from this post.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipeData.isRecipe) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: recipeData.error || 'This post doesn\'t appear to contain a recipe.' 
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
          confidence: recipeData.confidence || 'medium',
          sourceUrl: instagramUrl
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error importing Instagram recipe:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import recipe' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
