import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const requestSchema = z.object({
  imageBase64: z.string()
    .max(10 * 1024 * 1024, "Image too large (max 10MB)")
    .refine(
      (val) => !val || val.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 100)),
      "Invalid image format"
    )
    .optional(),
  searchQuery: z.string()
    .max(500, "Search query too long")
    .optional()
}).refine(
  (data) => data.imageBase64 || data.searchQuery,
  "Either imageBase64 or searchQuery is required"
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
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
      return new Response(
        JSON.stringify({ 
          error: "Invalid input", 
          details: validationResult.error.errors.map(e => e.message).join(", ")
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, searchQuery } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let messages: any[];
    
    if (imageBase64) {
      // Analyze food from image
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that analyzes food images to estimate nutritional content.
          
When analyzing a food image, you MUST respond with ONLY a JSON object in this exact format:
{
  "name": "Name of the food/dish",
  "calories": number (total estimated calories),
  "protein": number (grams of protein),
  "carbs": number (grams of carbohydrates),
  "fats": number (grams of fat),
  "confidence": "high" | "medium" | "low",
  "notes": "Brief notes about the estimation"
}

Be as accurate as possible based on typical portion sizes. If you can't identify the food clearly, make your best estimate and set confidence to "low".
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this food image and provide the nutritional information."
            },
            {
              type: "image_url",
              image_url: {
                url: imageBase64
              }
            }
          ]
        }
      ];
    } else if (searchQuery) {
      // Estimate nutrition from text search
      messages = [
        {
          role: "system",
          content: `You are a nutrition expert AI that estimates nutritional content for foods.
          
When given a food name or description, you MUST respond with ONLY a JSON object in this exact format:
{
  "name": "Name of the food/dish",
  "calories": number (total estimated calories for a typical serving),
  "protein": number (grams of protein),
  "carbs": number (grams of carbohydrates),
  "fats": number (grams of fat),
  "confidence": "high" | "medium" | "low",
  "notes": "Brief notes about typical serving size assumed"
}

Use accurate nutritional data for common foods. For complex dishes, estimate based on typical ingredients and portions.
Do not include any other text, only the JSON object.`
        },
        {
          role: "user",
          content: `Please provide the nutritional information for: ${searchQuery}`
        }
      ];
    } else {
      return new Response(
        JSON.stringify({ error: "Either imageBase64 or searchQuery is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Lovable AI for food analysis...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    console.log("AI response:", content);

    // Parse the JSON response
    let nutritionData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        nutritionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a fallback response
      nutritionData = {
        name: searchQuery || "Unknown Food",
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 8,
        confidence: "low",
        notes: "Could not analyze accurately. These are estimated values."
      };
    }

    return new Response(
      JSON.stringify(nutritionData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-food function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
