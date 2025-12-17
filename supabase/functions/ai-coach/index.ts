import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userContext, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt based on coaching type and user context
    let systemPrompt = `You are a supportive, evidence-based nutrition coach for CJTNutrition. Your role is to provide educational, science-backed guidance while maintaining a ${userContext?.coachingTone || 'supportive'} tone.

Core Values:
- Focus on whole, minimally processed foods
- Provide recommendations, not medical advice
- Every recommendation must have a reason behind it
- Focus on long-term, sustainable habits
- Consistency over perfection

User Context:
- Primary Goal: ${userContext?.primaryGoal || 'general health'}
- Daily Calorie Target: ${userContext?.targetCalories || 'not set'} kcal
- Protein Goal: ${userContext?.proteinGrams || 'not set'}g
- Activity Level: ${userContext?.activityLevel || 'not specified'}
- Sleep: ${userContext?.sleepHours || 'not specified'}
- Stress Level: ${userContext?.stressLevel || 'not specified'}

Guidelines:
- Keep responses concise but informative
- Always explain WHY behind any recommendation
- Be encouraging and never judgmental
- If asked about medical conditions, remind them to consult healthcare providers
- Offer practical, actionable tips`;

    if (type === 'meal_feedback') {
      systemPrompt += `\n\nYou are reviewing a meal the user logged. Provide brief, constructive feedback on:
1. How it fits their macro targets
2. One thing they did well
3. One small suggestion for improvement (if applicable)
Keep it positive and educational.`;
    } else if (type === 'daily_checkin') {
      systemPrompt += `\n\nYou are conducting a brief daily check-in. Ask about:
1. How they're feeling today
2. Any challenges with their nutrition
3. Celebrate any wins, no matter how small
Keep it conversational and supportive.`;
    } else if (type === 'focus_tip') {
      systemPrompt += `\n\nProvide a brief, actionable tip related to one of their focus points: ${userContext?.focusPoints?.join(', ') || 'general nutrition'}.
Keep it under 2-3 sentences and very practical.`;
    }

    console.log("Calling AI gateway with type:", type);

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
          { role: "user", content: message }
        ],
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
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm here to help with your nutrition journey!";

    console.log("AI response generated successfully");

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in ai-coach function:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
