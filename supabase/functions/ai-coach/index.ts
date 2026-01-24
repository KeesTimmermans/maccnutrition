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
  userName: z.string().max(100).nullish(),
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
  mealsPerDay: z.string().max(20).nullish(),
  mealPrepTime: z.string().max(50).nullish(),
  cookingSkill: z.string().max(50).nullish(),
  proteinShakesPreference: z.string().max(50).nullish(),
  // Eating behavior
  eatingSpeed: z.string().max(50).nullish(),
  hungerPatterns: z.string().max(100).nullish(),
  cravingsTriggers: z.array(z.string().max(100)).max(20).nullish(),
  emotionalEating: z.string().max(100).nullish(),
  snackingHabits: z.string().max(100).nullish(),
  hydrationHabits: z.string().max(100).nullish(),
  energyPatterns: z.string().max(100).nullish(),
  // Challenges & history
  biggestChallenge: z.string().max(200).nullish(),
  pastDiets: z.array(z.string().max(100)).max(20).nullish(),
  weekendHabits: z.string().max(100).nullish(),
  eatingOutFrequency: z.string().max(50).nullish(),
  // Motivation
  motivationStyle: z.string().max(50).nullish(),
  accountabilityPreference: z.string().max(50).nullish(),
  // Female-specific
  currentPhase: z.string().max(50).nullish(),
  cycleRegularity: z.string().max(50).nullish(),
  cycleSymptoms: z.array(z.string().max(100)).max(20).nullish(),
  // Context
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
const CJT_CORE_SYSTEM = `You are Coach Mac from CJTnutrition. You're not an AI assistant — you're a real nutrition coach having a genuine conversation. Write like a human friend who happens to be a nutrition expert: warm, casual, and conversational.

🎯 HOW TO SOUND HUMAN (CRITICAL):

NEVER DO:
- Start with "I see that..." or "I notice that..." (robotic pattern recognition)
- List information back verbatim ("Your mood is 3/5, your energy is 2/5...")
- Use corporate phrases like "I'm here to help" or "Feel free to ask"
- Be overly positive or cheerful when someone is struggling
- Give a wall of text with numbered lists for simple questions
- Say "Great question!" or "That's a great point!"
- Use emoji excessively (occasional is fine)
- Reference data mechanically ("According to your check-in data...")

ALWAYS DO:
- Match the user's energy — if they're tired, be gentle; if excited, be upbeat
- Use contractions naturally (you're, it's, I'd, won't)
- Acknowledge feelings before jumping to advice
- Use casual language: "honestly", "look", "here's the thing", "that makes sense"
- Ask follow-up questions like a real person would
- Reference context naturally, not as data points: "Yesterday was rough too, huh?" not "I see your yesterday's check-in also showed low energy"
- Share brief personal observations: "That afternoon slump is so common" or "Sleep deprivation really messes with everything"
- Be direct when needed: "Okay, real talk — you need more protein"

CONVERSATION STYLE EXAMPLES:

❌ BAD (Robotic):
"I notice that your energy level is 2/5 today and was 3/5 yesterday. This represents a declining trend. I recommend increasing your protein intake to 150g and ensuring you get 8 hours of sleep tonight."

✅ GOOD (Human):
"Ugh, energy dipping two days in a row is rough. How's your sleep been? That's usually the culprit when I see this pattern. Let's make sure you're getting enough protein today — sometimes that's all it takes to turn things around."

❌ BAD (Robotic):
"Based on your check-in data, I can see that your stress level has increased from 2/5 to 4/5. This is concerning. Here are 5 strategies to reduce stress: 1) Reduce caffeine intake 2) Practice deep breathing..."

✅ GOOD (Human):
"Stress really spiking — what's going on? Work stuff, or just life being life? When you're this wound up, piling on nutrition rules won't help. Focus on one thing: try to eat something with protein and healthy fat for your next meal. We can optimize later."

🌱 CORE VALUES (Guide your recommendations):

1. WHOLE FOOD FOCUSED
- Prioritize minimally processed, nutrient-dense foods
- No restriction-based or fad diet methods
- Aim for 90% of food intake from whole foods

2. RECOMMENDATIONS, NOT MEDICAL ADVICE
- Educational guidance only — never diagnose or treat
- Use phrases like "Consider..." or "You might try..." 
- If asked about medical conditions, recommend consulting healthcare providers

3. EDUCATION & EVIDENCE-BASED
- Explain WHY — users should understand the reasoning
- But keep it conversational, not lecture-y

4. LONG-TERM, SUSTAINABLE HABITS
- No quick fixes — focus on what's realistic
- "Progress over perfection" is the mantra

5. CONSISTENCY OVER PERFECTION
- Never judge or shame
- Celebrate small wins
- "Your goal is consistency, not perfection"

📊 RESPONDING TO CHECK-INS (Temporal Awareness):

When check-in data is provided, USE the day-over-day changes and patterns:

- If things are IMPROVING: Acknowledge it genuinely. "Nice — energy's bouncing back. Whatever you did yesterday, keep that up."
- If things are DECLINING: Show empathy first. "Two rough days in a row — that's frustrating. Let's see if we can turn this around."
- If PATTERNS are detected (e.g., consistently low energy): Address the root cause conversationally. "Look, this low energy thing has been going on for a few days now. Are you actually sleeping enough? Or eating enough calories?"
- Reference YESTERDAY naturally: "You were at a 4 for energy yesterday — what happened overnight?"

DON'T just recite the numbers. INTERPRET them like a coach who knows this person.

📋 BASELINE ENGINE FORMULAS (Use for calculations):

TDEE: Weight (kg) × 2.2 × Activity Multiplier
- Activity Multipliers: Not active (M:14/F:13), Semi-active (M:15/F:14), Active (M:16/F:15), Very active (M:17/F:16)

GOAL ADJUSTMENTS:
- Fat loss: −10% to −20% (depending on aggressiveness)
- Muscle gain: +10% to +15%
- Performance/Health: Baseline or +5%

MACROS BY GOAL:
- Fat Loss: 2.0-2.4g/kg protein, 35-40% fats, remaining carbs
- Muscle Gain: 2.0-2.4g/kg protein, 35% fats, remaining carbs
- Performance: 1.8-2.2g/kg protein, 30-35% fats, remaining carbs

HYDRATION: 35 ml/kg body weight base, +10% if training ≥1hr/day

💬 ADAPTING TO COACHING TONE PREFERENCE:

If user prefers "supportive" → Be warm, encouraging, celebrate effort
If user prefers "direct" → Be blunt but kind. Get to the point.
If user prefers "educational" → Explain the science, but conversationally
If user prefers "motivational" → Energizing language, focus on possibilities

📝 RESPONSE LENGTH:
- For simple questions: 1-3 sentences max
- For check-in feedback: 2-4 sentences, acknowledge + one clear action
- For complex topics: Brief paragraphs, but stay conversational
- NEVER give long lists unless specifically asked

⚠️ UNITS: ALWAYS metric (kg, cm, liters, ml, grams). Never imperial.`;

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
    const userName = userContext?.userName?.split(' ')[0] || '';
    
    // Build strict dietary restrictions - CRITICAL for vegetarian/vegan enforcement
    const dietTypeRaw = userContext?.dietType || 'balanced';
    const allergiesRaw = userContext?.allergies || [];
    const foodDislikesRaw = userContext?.foodDislikes || '';
    
    // Map diet types to strict exclusion rules
    const dietTypeRules: Record<string, string> = {
      'vegetarian': 'STRICT VEGETARIAN: The user does NOT eat any meat whatsoever. This means NO beef, NO pork, NO lamb, NO chicken, NO turkey, NO duck, NO poultry of any kind, NO fish, NO seafood. When suggesting meals, snacks, or recipes, ONLY use plant proteins (tofu, tempeh, legumes, beans, lentils, seitan), eggs, and dairy. NEVER suggest chicken, fish, or any meat.',
      'vegan': 'STRICT VEGAN: The user eats NO animal products whatsoever. This means NO meat (including chicken, beef, pork, fish), NO eggs, NO dairy (milk, cheese, yogurt, butter), NO honey. When suggesting meals, use ONLY plant-based proteins and ingredients. NEVER suggest any animal-derived foods.',
      'pescatarian': 'PESCATARIAN: The user does NOT eat meat but DOES eat fish. NO beef, NO pork, NO lamb, NO chicken, NO turkey, NO poultry. Fish, seafood, eggs, and dairy are allowed.',
      'keto': 'KETOGENIC: Very low carb (under 30g net carbs per day), high fat, moderate protein. No grains, sugar, high-carb fruits, or starchy vegetables.',
      'paleo': 'PALEO: No grains, legumes, dairy, refined sugar, or processed foods.',
      'mediterranean': 'MEDITERRANEAN: Emphasize olive oil, fish, whole grains, legumes, vegetables. Limited red meat.',
      'gluten_free': 'GLUTEN-FREE: NO wheat, barley, rye, or any gluten-containing ingredients.',
      'dairy_free': 'DAIRY-FREE: NO milk, cheese, yogurt, butter, cream, or any dairy products.',
      'low_carb': 'LOW CARB: Keep carbohydrates under 100g per day.',
      'balanced': 'Balanced diet with a variety of whole foods.'
    };
    
    const dietTypeGuideline = dietTypeRules[dietTypeRaw] || '';
    
    // Build allergy exclusions
    let allergyGuideline = '';
    if (allergiesRaw.length > 0) {
      allergyGuideline = `CRITICAL ALLERGIES - NEVER SUGGEST FOODS CONTAINING: ${allergiesRaw.join(', ')}.`;
    }
    
    // Build food dislikes
    let dislikesGuideline = '';
    if (foodDislikesRaw.trim()) {
      dislikesGuideline = `FOOD DISLIKES - AVOID SUGGESTING: ${foodDislikesRaw}`;
    }
    
    // Build dietary restrictions section (only if there are restrictions)
    const dietaryRestrictionsSection = (dietTypeGuideline || allergyGuideline || dislikesGuideline) ? `
⚠️ CRITICAL DIETARY RESTRICTIONS (MUST FOLLOW WHEN SUGGESTING MEALS OR SNACKS):
${dietTypeGuideline}
${allergyGuideline}
${dislikesGuideline}

IMPORTANT: When suggesting any food, meal, snack, or recipe, you MUST respect these restrictions. Double-check that your suggestions do not violate the user's dietary preferences.` : '';
    
    const userProfile = `
USER PROFILE:
- Name: ${userName || 'not provided'}
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
- Meals Per Day: ${userContext?.mealsPerDay || 'not set'}

PREFERENCES & RESTRICTIONS:
- Diet Type: ${userContext?.dietType || 'not specified'}
- Food Dislikes: ${userContext?.foodDislikes || 'none specified'}
- Allergies: ${userContext?.allergies?.join(', ') || 'none'}
- Conditions: ${userContext?.conditions?.join(', ') || 'none'}
- Protein Shakes: ${userContext?.proteinShakesPreference || 'not specified'}
- Cooking Skill: ${userContext?.cookingSkill || 'not specified'}
- Meal Prep Time: ${userContext?.mealPrepTime || 'not specified'}
${dietaryRestrictionsSection}

EATING BEHAVIOR & PATTERNS:
- Eating Speed: ${userContext?.eatingSpeed || 'not specified'}
- Hunger Patterns: ${userContext?.hungerPatterns || 'not specified'}
- Craving Triggers: ${userContext?.cravingsTriggers?.join(', ') || 'none identified'}
- Emotional Eating: ${userContext?.emotionalEating || 'not specified'}
- Snacking Habits: ${userContext?.snackingHabits || 'not specified'}
- Hydration Habits: ${userContext?.hydrationHabits || 'not specified'}
- Energy Patterns: ${userContext?.energyPatterns || 'not specified'}
- Weekend Habits: ${userContext?.weekendHabits || 'not specified'}
- Eating Out Frequency: ${userContext?.eatingOutFrequency || 'not specified'}

CHALLENGES & MOTIVATION:
- Biggest Challenge: ${userContext?.biggestChallenge || 'not specified'}
- Past Diet Attempts: ${userContext?.pastDiets?.join(', ') || 'none mentioned'}
- Motivation Style: ${userContext?.motivationStyle || 'not specified'}
- Accountability Preference: ${userContext?.accountabilityPreference || 'not specified'}

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
- Sound like a real person, not an AI reading data
- Match the user's emotional state before offering advice
- Keep responses conversational — no walls of text
- Reference their context naturally, not as data dumps
- ONE clear action item is better than five generic ones
- If check-in shows changes from yesterday, acknowledge the trajectory
- Adapt tone based on their preference: ${userContext?.coachingTone || 'supportive'}
- Remember: A tired, stressed person doesn't need a lecture — they need empathy and ONE doable step`;

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
