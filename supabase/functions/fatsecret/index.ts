import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// OAuth 2.0 Client Credentials Token Cache
// ============================================
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getFatSecretToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const clientId = Deno.env.get('FATSECRET_CLIENT_ID');
  const clientSecret = Deno.env.get('FATSECRET_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('FATSECRET_CLIENT_ID or FATSECRET_CLIENT_SECRET not configured');
  }

  console.log('[FatSecret] Requesting new OAuth token');

  const response = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[FatSecret] Token error:', response.status, errorText);
    throw new Error(`FatSecret auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  console.log('[FatSecret] Token acquired, expires in', data.expires_in, 'seconds');
  return cachedToken.access_token;
}

// ============================================
// FatSecret API v2 (REST)
// ============================================

interface FatSecretServing {
  serving_id: string;
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type: string;
  food_description: string;
}

interface FatSecretFoodDetail {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_type: string;
  servings: {
    serving: FatSecretServing | FatSecretServing[];
  };
}

async function searchFoods(query: string, maxResults: number = 5): Promise<FatSecretFood[]> {
  const token = await getFatSecretToken();

  const params = new URLSearchParams({
    method: 'foods.search',
    search_expression: query,
    format: 'json',
    max_results: String(maxResults),
  });

  const response = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[FatSecret] Search error:', response.status, errorText);
    return [];
  }

  const data = await response.json();
  console.log('[FatSecret] Search raw response:', JSON.stringify(data).substring(0, 500));
  const foods = data?.foods?.food;
  console.log('[FatSecret] Foods found:', foods ? (Array.isArray(foods) ? foods.length : 1) : 0);

  if (!foods) return [];
  return Array.isArray(foods) ? foods : [foods];
}

async function getFoodDetails(foodId: string): Promise<FatSecretFoodDetail | null> {
  const token = await getFatSecretToken();

  const params = new URLSearchParams({
    method: 'food.get.v4',
    food_id: foodId,
    format: 'json',
  });

  const response = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[FatSecret] Detail error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  return data?.food || null;
}

function parseServingNutrition(serving: FatSecretServing) {
  return {
    serving_id: serving.serving_id,
    serving_description: serving.serving_description,
    metric_serving_amount: parseFloat(serving.metric_serving_amount || '0'),
    metric_serving_unit: serving.metric_serving_unit || 'g',
    calories: parseFloat(serving.calories || '0'),
    protein: parseFloat(serving.protein || '0'),
    carbs: parseFloat(serving.carbohydrate || '0'),
    fats: parseFloat(serving.fat || '0'),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Support both /fatsecret/search and /fatsecret?action=search
    const pathParts = url.pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1] === 'fatsecret'
      ? (url.searchParams.get('action') || 'search')
      : pathParts[pathParts.length - 1];

    if (action === 'search') {
      const query = url.searchParams.get('query');
      if (!query) {
        return new Response(JSON.stringify({ error: 'query parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[FatSecret] Searching: ${query}`);
      const foods = await searchFoods(query);

      // For each result, parse the description line for quick macros
      const results = foods.map(f => {
        // food_description format: "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 8.00g"
        const desc = f.food_description || '';
        const calMatch = desc.match(/Calories:\s*([\d.]+)/);
        const fatMatch = desc.match(/Fat:\s*([\d.]+)/);
        const carbMatch = desc.match(/Carbs:\s*([\d.]+)/);
        const protMatch = desc.match(/Protein:\s*([\d.]+)/);
        const servingMatch = desc.match(/^Per\s+(.+?)\s*-/);

        return {
          food_id: f.food_id,
          food_name: f.food_name,
          brand_name: f.brand_name || null,
          food_type: f.food_type,
          serving_description: servingMatch?.[1] || 'per serving',
          calories: parseFloat(calMatch?.[1] || '0'),
          protein: parseFloat(protMatch?.[1] || '0'),
          carbs: parseFloat(carbMatch?.[1] || '0'),
          fats: parseFloat(fatMatch?.[1] || '0'),
        };
      });

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'foodDetails') {
      const foodId = url.searchParams.get('foodId');
      if (!foodId) {
        return new Response(JSON.stringify({ error: 'foodId parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[FatSecret] Getting details for food ID: ${foodId}`);
      const food = await getFoodDetails(foodId);

      if (!food) {
        return new Response(JSON.stringify({ error: 'Food not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const servingsRaw = food.servings?.serving;
      const servings = Array.isArray(servingsRaw) ? servingsRaw : servingsRaw ? [servingsRaw] : [];
      const parsedServings = servings.map(parseServingNutrition);

      // Pick the best serving: prefer "per 100g", then first
      const per100g = parsedServings.find(s =>
        s.serving_description.toLowerCase().includes('100g') ||
        s.serving_description.toLowerCase().includes('100 g')
      );
      const defaultServing = per100g || parsedServings[0] || null;

      return new Response(JSON.stringify({
        food_id: food.food_id,
        food_name: food.food_name,
        brand_name: food.brand_name || null,
        food_type: food.food_type,
        servings: parsedServings,
        default_serving: defaultServing,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown endpoint. Use /search or /foodDetails' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[FatSecret] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
