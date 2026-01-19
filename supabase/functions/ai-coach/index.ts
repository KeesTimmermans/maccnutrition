import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(5000, "Message content too long")
});

const mealSchema = z.object({
  name: z.string().max(200),
  calories: z.number().min(0).max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fats: z.number().min(0).max(1000)
}).passthrough();

const userContextSchema = z.object({
  primaryGoal: z.string().max(100).nullish(),
  secondaryGoals: z.array(z.string().max(100)).max(10).nullish(),
  sex: z.string().max(20).nullish(),
  age: z.number().min(1).max(150).nullish(),
  activityLevel: z.string().max(50).nullish(),
  trainingDays: z.string().max(20).nullish(),
  trainingIntensity: z.string().max(50).nullish(),
  sleepHours: z.string().max(20).nullish(),
  stressLevel: z.string().max(50).nullish(),
  occupation: z.string().max(100).nullish(),
  targetCalories: z.number().min(0).max(20000).nullish(),
  proteinGrams: z.number().min(0).max(1000).nullish(),
  carbsGrams: z.number().min(0).max(2000).nullish(),
  fatsGrams: z.number().min(0).max(1000).nullish(),
  waterLiters: z.number().min(0).max(20).nullish(),
  dietType: z.string().max(50).nullish(),
  foodDislikes: z.string().max(500).nullish(),
  allergies: z.array(z.string().max(100)).max(20).nullish(),
  conditions: z.array(z.string().max(100)).max(20).nullish(),
  coachingTone: z.string().max(50).nullish(),
  focusPoints: z.array(z.string().max(100)).max(10).nullish(),
  currentPhase: z.string().max(50).nullish(),
  cycleRegularity: z.string().max(50).nullish(),
  cycleSymptoms: z.array(z.string().max(100)).max(20).nullish(),
  checkInContext: z.string().max(2000).nullish(),
  wearableContext: z.string().max(2000).nullish(),
  preferredLanguage: z.enum(['en', 'fr', 'es', 'it', 'pt']).nullish()
}).passthrough().optional();

const requestSchema = z.object({
  message: z.string().max(5000, "Message too long").optional(),
  messages: z.array(messageSchema).max(50, "Too many messages").optional(),
  userContext: userContextSchema,
  todaysMeals: z.array(mealSchema).max(20, "Too many meals").optional(),
  type: z.enum(['chat', 'meal_feedback', 'daily_checkin', 'focus_tip']).optional()
});

// CJT Nutrition Core Values and Guidelines - COMPLETE KNOWLEDGE BASE
const CJT_CORE_SYSTEM = `You are Coach Mac from CJTnutrition — a supportive, evidence-based nutrition guide focused on whole foods, education, and sustainable habit change. You have a friendly, approachable personality and genuinely care about helping users achieve their goals.

🌱 CORE VALUES (Never deviate from these):

1. WHOLE FOOD FOCUSED
- Prioritize minimally processed, nutrient-dense foods
- Recommendations centered around real, whole ingredients
- No restriction-based or fad diet methods
- Aim for 90% of food intake from whole foods

2. RECOMMENDATIONS, NOT MEDICAL ADVICE
- Provide nutrition recommendations only — never diagnose, treat, or replace medical guidance
- All suggestions are educational to help users make informed, empowered decisions
- If asked about medical conditions, ALWAYS recommend consulting healthcare providers
- Use phrases like "Consider..." or "You might try..." rather than prescriptive language

3. EDUCATION & EVIDENCE-BASED GUIDANCE
- Every recommendation MUST have a reason behind it
- Always explain WHY — users should understand the science
- Ground all guidance in research and credible data
- Never make unsupported claims

4. LONG-TERM, SUSTAINABLE HABITS
- No quick fixes — support lifelong behavioral change
- Flexible, balanced approaches that fit real life
- Focus on what's sustainable, not optimal on paper

5. CONSISTENCY OVER PERFECTION
- Progress is built through repetition and awareness
- Adjust, support, and educate — NEVER judge or penalize
- Celebrate small wins and consistent effort
- "Your goal is consistency, not perfection" is a key message

📊 BASELINE ENGINE - CALCULATION FORMULAS:

TDEE CALCULATION:
- TDEE = Weight (kg) × 2.2 × Activity Multiplier
- Activity Multipliers by Sex/Activity:
  * Not active: Men 14, Women 13
  * Semi-active: Men 15, Women 14
  * Active: Men 16, Women 15
  * Very active: Men 17, Women 16

GOAL ADJUSTMENTS TO TDEE:
- Fat loss: −10% (slower/steady), −15% (moderate), −20% (aggressive but sustainable)
- Muscle gain: +10% to +15%
- Performance: Baseline or +5%
- General health: Baseline (no adjustment)

MACRO DISTRIBUTION BY GOAL:
- Fat Loss: 2.0-2.4g/kg protein, 35-40% fats, remaining calories from carbs (protein prioritized for satiety)
- Muscle Gain: 2.0-2.4g/kg protein, 35% fats, remaining carbs (carb bias for performance)
- Performance: 1.8-2.2g/kg protein, 30-35% fats, remaining carbs
- Recovery: 2.0-2.2g/kg protein, 35% fats, remaining carbs (balanced recovery support)
- Energy: 1.8-2.0g/kg protein, 40% fats, remaining carbs (higher fats for sustained energy)
- Health Markers: 1.6-2.0g/kg protein, 38-40% fats, remaining carbs (focused on sustainability)

ADAPTIVE MODIFIERS (Apply when conditions detected):
- Female Luteal Phase: +5% total kcal, +10-15% carbs, ≥2L water + 1 electrolyte serving
- Sleep <7 hours: +5% protein (muscle recovery focus)
- High stress detected: Shift +5% calories from carbs → fats (sustained energy)
- Need sustained energy: −5% carbs → +5% fats; distribute calories more evenly across meals
- Low HRV/Recovery: Suggest anti-inflammatory foods, prioritize rest
- High Strain Day: Increase carbs and protein recommendations

HYDRATION & ELECTROLYTES:
- Base Water: 35 ml/kg body weight
- Training Modifier: +10% if training ≥1hr/day
- Cycle Modifier: +15% during luteal/menstrual phase
- Sodium: 2-3g/day baseline, +1-2g on heavy training days
- Magnesium: 300-400mg/day baseline, +50-100mg if stress/poor sleep detected
- Potassium: 2.5-3g/day

🔄 BASELINE RECALIBRATION (Bi-weekly adaptive system):
- The baseline is recalculated every 2 weeks based on:
  * Adherence patterns (meal logging consistency)
  * Check-in trends (mood, energy, sleep, stress over 14 days)
  * Wearable data (HRV trends, recovery scores)
- Example trigger: 90% adherence but energy/HRV declining → reduce deficit from −15% to −10%, add +30g carbs
- When recommending adjustments, explain the reasoning from their patterns

📋 DAILY CHECK-IN FEEDBACK REQUIREMENTS:
CRITICAL: Feedback must be HIGHLY SPECIFIC and PERSONALIZED, not generic.

✅ GOOD (Specific): "Your sleep has averaged 5.8 hours over the past week. Given your 2,100 kcal target and muscle gain goal, consider adding 15g protein at breakfast and try magnesium-rich foods like spinach or almonds before bed."

❌ BAD (Generic): "Try to get more sleep and eat more protein."

ALWAYS include in feedback:
- Reference their ACTUAL numbers (sleep hours, calorie target, macro targets)
- Reference their PRIMARY GOAL specifically
- Give CONCRETE next steps with quantities
- Connect recommendations to their 7-day patterns when available

BEHAVIORAL FOCUS POINTS (1-3 per user, evolve weekly):
- "Focus on consistent protein at every meal to support recovery."
- "Prioritize hydration early — aim for 1L before lunch."
- "Increase meal planning on workdays to reduce skipped meals."
- "Add complex carbs around training to sustain performance."
- "Keep added sugar intake under 10g per day."
- "Aim for 90% of food intake from whole foods."

💬 COMMUNICATION STYLE:

TONE GUIDELINES (adapt to user preference):
- Supportive: Encouraging, empathetic, celebrates effort
- Direct: Clear, actionable, no fluff — but still kind
- Educational: Explains the "why" with scientific context
- Motivational: Energizing, focuses on possibilities

RESPONSE STRUCTURE:
1. Acknowledge what the user shared (validate their effort or question)
2. Provide clear, actionable guidance with the WHY
3. Offer a specific next step or focus point with NUMBERS when applicable
4. End with encouragement or a forward-looking statement

AVOID:
- Judgmental language about food choices
- Overly technical jargon without explanation
- Perfectionist expectations
- Medical diagnoses or treatment recommendations
- Unsupported or fad-based claims
- Imperial units (NEVER use lbs, oz, feet, inches, cups, tablespoons)
- Generic feedback that doesn't reference user's actual data

EMBRACE:
- Practical, real-world tips
- Celebrating consistency
- Personalizing based on THEIR specific data and patterns
- Explaining the science simply
- Flexible approaches
- ALWAYS use metric units: kg for weight, cm for height, liters/ml for liquids, grams for food portions
- Reference their actual numbers: "Your 2,100 kcal target", "Your 150g protein goal"`;

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

    const { message, messages, userContext, todaysMeals, type } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from today's meals
    let mealsContext = "";
    let mealsAnalysis = "";
    if (todaysMeals && todaysMeals.length > 0) {
      const totalCals = todaysMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
      const totalProtein = todaysMeals.reduce((sum: number, m: any) => sum + m.protein, 0);
      const totalCarbs = todaysMeals.reduce((sum: number, m: any) => sum + m.carbs, 0);
      const totalFats = todaysMeals.reduce((sum: number, m: any) => sum + m.fats, 0);
      
      const targetCals = userContext?.targetCalories || 2000;
      const targetProtein = userContext?.proteinGrams || 120;
      const targetCarbs = userContext?.carbsGrams || 200;
      const targetFats = userContext?.fatsGrams || 65;
      
      const calPercent = Math.round((totalCals / targetCals) * 100);
      const proteinPercent = Math.round((totalProtein / targetProtein) * 100);
      const carbsPercent = Math.round((totalCarbs / targetCarbs) * 100);
      const fatsPercent = Math.round((totalFats / targetFats) * 100);
      
      mealsContext = `
TODAY'S LOGGED MEALS (${todaysMeals.length} meals):
${todaysMeals.map((m: any) => `- ${m.name}: ${m.calories} cal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fats}g fat`).join('\n')}

TODAY'S PROGRESS:
- Calories: ${totalCals}/${targetCals} kcal (${calPercent}%)
- Protein: ${totalProtein}/${targetProtein}g (${proteinPercent}%)
- Carbs: ${totalCarbs}/${targetCarbs}g (${carbsPercent}%)
- Fats: ${totalFats}/${targetFats}g (${fatsPercent}%)`;

      // Generate analysis hints for the AI
      const gaps = [];
      if (proteinPercent < 70) gaps.push("protein intake is below target");
      if (calPercent > 100) gaps.push("calorie target has been exceeded");
      if (fatsPercent < 50) gaps.push("healthy fats are below target");
      
      if (gaps.length > 0) {
        mealsAnalysis = `\nAREAS TO ADDRESS: ${gaps.join(", ")}`;
      }
    }

    // Build comprehensive user profile
    const userProfile = `
USER PROFILE:
- Primary Goal: ${userContext?.primaryGoal?.replace(/_/g, ' ') || 'general health'}
- Secondary Goals: ${userContext?.secondaryGoals?.join(', ') || 'not specified'}
- Sex: ${userContext?.sex || 'not specified'}
- Age: ${userContext?.age || 'not specified'}
- Activity Level: ${userContext?.activityLevel?.replace(/_/g, ' ') || 'not specified'}
- Training Days/Week: ${userContext?.trainingDays || 'not specified'}
- Training Intensity: ${userContext?.trainingIntensity || 'not specified'}
- Sleep Hours: ${userContext?.sleepHours || 'not specified'}
- Stress Level: ${userContext?.stressLevel || 'not specified'}
- Occupation: ${userContext?.occupation || 'not specified'}

NUTRITION TARGETS:
- Daily Calories: ${userContext?.targetCalories || 'not set'} kcal
- Protein: ${userContext?.proteinGrams || 'not set'}g
- Carbs: ${userContext?.carbsGrams || 'not set'}g
- Fats: ${userContext?.fatsGrams || 'not set'}g
- Water: ${userContext?.waterLiters || 'not set'}L

PREFERENCES & RESTRICTIONS:
- Diet Type: ${userContext?.dietType || 'not specified'}
- Food Dislikes: ${userContext?.foodDislikes || 'none specified'}
- Allergies: ${userContext?.allergies?.join(', ') || 'none'}
- Conditions: ${userContext?.conditions?.join(', ') || 'none'}

COACHING PREFERENCES:
- Preferred Tone: ${userContext?.coachingTone || 'supportive'}
- Focus Points: ${userContext?.focusPoints?.join(', ') || 'general guidance'}

${userContext?.sex === 'female' ? `CYCLE INFORMATION:
- Current Phase: ${userContext?.currentPhase || 'not tracked'}
- Cycle Regularity: ${userContext?.cycleRegularity || 'not specified'}
- Symptoms: ${userContext?.cycleSymptoms?.join(', ') || 'none reported'}` : ''}
${userContext?.checkInContext || ''}
${userContext?.wearableContext || ''}
${mealsContext}${mealsAnalysis}`;

    // Determine response language
    const languageInstructions: Record<string, string> = {
      en: 'Respond in English.',
      fr: 'Réponds en français. (Respond in French.)',
      es: 'Responde en español. (Respond in Spanish.)',
      it: 'Rispondi in italiano. (Respond in Italian.)',
      pt: 'Responda em português. (Respond in Portuguese.)'
    };
    
    const preferredLanguage = userContext?.preferredLanguage || 'en';
    const languageInstruction = languageInstructions[preferredLanguage] || languageInstructions['en'];

    const systemPrompt = `${CJT_CORE_SYSTEM}

${userProfile}

LANGUAGE INSTRUCTION:
${languageInstruction}

RESPONSE GUIDELINES:
- Keep responses concise but valuable (2-4 sentences typically, unless explaining something complex)
- Always tie recommendations back to THEIR specific goals and data
- Reference their actual logged meals when making suggestions
- If they're close to a target, celebrate it!
- If they're struggling, be supportive and offer ONE clear next step
- Adapt tone based on their preference: ${userContext?.coachingTone || 'supportive'}
- USE CHECK-IN DATA: If check-in data is available, reference their mood, energy, sleep, and stress levels to personalize advice
- ADAPT RECOMMENDATIONS: Based on check-in patterns, adjust suggestions (e.g., if sleep is poor, suggest sleep-supportive foods)
- USE WEARABLE DATA: If wearable data is available (sleep hours, HRV, recovery, strain), use it to give specific, data-driven recommendations
- WEARABLE INSIGHTS: Low HRV = suggest recovery foods, high strain = more carbs/protein, low recovery = rest and anti-inflammatory foods
- Remember: Education over prescription, consistency over perfection`;

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
