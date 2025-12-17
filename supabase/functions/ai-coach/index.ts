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
    const { message, messages, userContext, todaysMeals, type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from today's meals
    let mealsContext = "";
    if (todaysMeals && todaysMeals.length > 0) {
      const totalCals = todaysMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
      const totalProtein = todaysMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
      const totalCarbs = todaysMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
      const totalFats = todaysMeals.reduce((sum: number, m: any) => sum + m.fats, 0);
      
      mealsContext = `
Today's Logged Meals (${todaysMeals.length} meals):
${todaysMeals.map((m: any) => `- ${m.name}: ${m.calories} cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fats}g fat`).join('\n')}

Today's Totals: ${totalCals} calories, ${totalProtein}g protein, ${totalCarbs}g carbs, ${totalFats}g fat`;
    }

    const systemPrompt = `You are a supportive, evidence-based nutrition coach for CJTNutrition. Your role is to provide educational, science-backed guidance while maintaining a ${userContext?.coachingTone || 'supportive'} tone.

Core Values:
- Focus on whole, minimally processed foods
- Provide recommendations, not medical advice
- Every recommendation must have a reason behind it
- Focus on long-term, sustainable habits
- Consistency over perfection

User Profile:
- Primary Goal: ${userContext?.primaryGoal || 'general health'}
- Daily Calorie Target: ${userContext?.targetCalories || 'not set'} kcal
- Protein Goal: ${userContext?.proteinGrams || 'not set'}g
- Carbs Goal: ${userContext?.carbsGrams || 'not set'}g
- Fats Goal: ${userContext?.fatsGrams || 'not set'}g
- Activity Level: ${userContext?.activityLevel || 'not specified'}
- Training Days: ${userContext?.trainingDays || 'not specified'}
- Sleep: ${userContext?.sleepHours || 'not specified'}
- Stress Level: ${userContext?.stressLevel || 'not specified'}
- Diet Type: ${userContext?.dietType || 'not specified'}
- Food Dislikes: ${userContext?.foodDislikes || 'none specified'}
${mealsContext}

Guidelines:
- Keep responses concise but informative (2-4 sentences typically)
- Always explain WHY behind any recommendation
- Be encouraging and never judgmental
- Reference their actual logged meals when relevant
- If asked about medical conditions, remind them to consult healthcare providers
- Offer practical, actionable tips
- Use their actual data to personalize advice`;

    // Build messages array for chat
    let apiMessages: any[] = [{ role: "system", content: systemPrompt }];
    
    if (messages && messages.length > 0) {
      // Add conversation history
      apiMessages = apiMessages.concat(messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })));
    } else if (message) {
      // Single message (legacy support)
      apiMessages.push({ role: "user", content: message });
    }

    console.log("Calling AI gateway for chat, messages count:", apiMessages.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
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

    console.log("AI chat response generated successfully");

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
