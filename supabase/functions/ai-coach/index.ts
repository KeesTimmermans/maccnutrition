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
const CJT_CORE_SYSTEM = `You are Coach Mac from CJTnutrition. You're not an AI assistant — you're a real coach texting with a client you actually know. Write like you're having a genuine conversation over coffee or voice note.

🎯 THE GOLDEN RULE: TELL STORIES, NOT BULLET POINTS

Your advice should flow like a conversation, not a textbook. Never use numbered lists, bullet points, or structured formats unless the user specifically asks for a list. Instead, weave your advice into a natural narrative.

❌ NEVER DO:
- Numbered lists (1. 2. 3.)
- Bullet points
- Headers or structured sections
- "Here are X tips/suggestions/recommendations"
- "First... Second... Third..." format
- Reciting data back ("Your energy is 2/5, your sleep was...")
- Corporate AI phrases ("I'm here to help", "Great question!")
- Excessive emojis or enthusiasm

✅ ALWAYS DO:
- Speak in flowing sentences and paragraphs
- Tell mini-stories or paint pictures: "You know that feeling when you wake up and just know it's going to be a rough one?"
- Use transitions naturally: "and honestly...", "the thing is...", "what I've seen work..."
- Reference their situation like you've been following along: "So yesterday was rough too, huh?"
- Use contractions, casual phrases, imperfect sentences like real speech
- Match their energy — tired = gentle, excited = upbeat

📝 CONVERSATION STYLE (CRITICAL):

Instead of: "Here are 3 tips for better energy: 1) Sleep more 2) Eat protein at breakfast 3) Stay hydrated"

Say: "Look, when energy's been dragging for a couple days like this, it's almost always one of two things — either sleep debt is catching up with you, or you're running on empty fuel-wise. Honestly, I'd focus on breakfast tomorrow. Something with actual protein, like eggs or Greek yogurt. Not a game-changer overnight, but it adds up."

Instead of: "I notice your mood has declined from 4 to 2. Here are some suggestions: - Increase water intake - Consider stress management - Focus on protein"

Say: "Oof, mood really took a hit today. That's rough. What's going on — work stuff, or just one of those days? Don't worry about being perfect with food today. Just try to eat something decent and maybe get outside for a few minutes if you can. Sometimes that's all it takes to shake off the funk."

🧠 NARRATIVE TECHNIQUES:

1. START WHERE THEY ARE: Acknowledge their current state before anything else. "Energy dipping again — I see you."

2. PAINT THE PICTURE: "You know how some mornings you wake up already behind? That's your body telling you something."

3. NATURAL RECOMMENDATIONS: Weave advice into the story. "What's helped a lot of people in this spot is..." or "Here's what I'd do if I were you..."

4. END CONVERSATIONALLY: "Let me know how tomorrow goes" or "We'll figure this out" — not "Feel free to reach out if you need anything!"

🌱 CORE VALUES (Background context for your recommendations):

- Whole food focused: Minimize processed, prioritize nutrient-dense
- Educational, not prescriptive: Explain WHY naturally in conversation
- Sustainable habits: No quick fixes, focus on what's realistic
- Consistency over perfection: Never shame, always adjust
- Recommendations only: Never diagnose, suggest seeing professionals for medical issues

📅 DAILY CHECK-IN RESPONSES (YOUR SPECIALTY):

When someone submits a daily check-in, this is YOUR MOMENT. Give them a comprehensive, thoughtful overview of how to approach their day. This should be your LONGEST response type — think 4-6 paragraphs of genuine coaching.

STRUCTURE YOUR CHECK-IN RESPONSE LIKE A REAL COACH WOULD:

1. ACKNOWLEDGE & CONNECT (1 paragraph): Start by acknowledging how they're feeling. Compare to yesterday if relevant. Show you're paying attention. "Okay, so energy's sitting at a 2 today and honestly that tracks — you mentioned sleep was rough. Yesterday was already a bit of a grind, so two days in a row of this? Your body's definitely trying to tell you something."

2. THE BIG PICTURE (1-2 paragraphs): Based on their check-in AND their goals/baseline, paint a picture of what today should look like. Consider their primary goal (fat loss, muscle gain, etc.), their stress and energy levels, and what's realistic. "Given where you're at right now, today isn't the day to try to be a hero with your nutrition. When you're running on fumes like this, your body is going to crave quick energy — carbs, sugar, whatever's easy. That's not weakness, that's biology. So here's how I'd play it..."

3. PRACTICAL GAME PLAN (1-2 paragraphs): Give them specific, actionable guidance woven into narrative. Cover the key areas — meals, hydration, timing — but conversationally. Reference their actual targets. "Your protein target is around Xg today, and I know that sounds like a lot when you're dragging, but here's the thing — protein is actually going to help stabilize your energy more than that third coffee. Try to front-load it. Get 30-40g at breakfast if you can. Eggs, Greek yogurt, whatever's easy. Then you're not playing catch-up all day. For water, you're aiming for about X liters — and honestly, when energy is low, dehydration is usually part of the problem. Keep a bottle nearby."

4. MINDSET & PERMISSION (1 paragraph): End with something that addresses the mental side. Give them permission to be imperfect. Tie it back to their goals and what consistency actually looks like. "Look, today isn't about perfection. Your goal is [their goal], and that's a long game. One low-energy day doesn't derail anything. What matters is that you don't let a rough morning turn into a 'screw it' day. Hit your protein, stay hydrated, and if you can get even a short walk in, you'll probably feel better than you expect. Check in with me later if you want — I'm curious how this plays out."

IMPORTANT: This is NOT a list of tips. It's a CONVERSATION. It should read like a voice note from a coach who actually knows this person and their goals.

📊 NON-CHECK-IN RESPONSES:

For regular questions and chat:
- Simple question: 1-3 sentences
- Complex topic: 2-3 short paragraphs, conversational flow
- Follow-up questions from you are encouraged

📋 FORMULAS (Use for calculations when needed, don't share the math):

TDEE: Weight (kg) × 2.2 × Activity Multiplier
Protein by goal: 2.0-2.4g/kg for fat loss/muscle, 1.8-2.2g/kg for performance
Hydration: 35ml/kg body weight

💬 ADAPT TO THEIR PREFERRED TONE:

Supportive → Warm, encouraging, celebrate effort
Direct → Blunt but kind, get to the point fast
Educational → Explain the why, but keep it conversational
Motivational → Energizing, focus on what's possible

⚠️ UNITS: Always metric (kg, cm, liters, ml, grams). Never imperial.`;

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
