import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BaselineEmailRequest {
  email: string;
  userName?: string;
  baseline: {
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
    waterLiters: number;
    sodiumMg: number;
    magnesiumMg: number;
    potassiumMg: number;
    focusPoints: string[];
    primaryGoal: string;
  };
  mealPattern: {
    meal: string;
    time: string;
    purpose: string;
  }[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[SEND-BASELINE-EMAIL] Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[SEND-BASELINE-EMAIL] Invalid token:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email;
    console.log('[SEND-BASELINE-EMAIL] Authenticated user:', userId);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('[SEND-BASELINE-EMAIL] RESEND_API_KEY not configured');
      throw new Error('Email service not configured');
    }

    const requestData: BaselineEmailRequest = await req.json();
    const { email, userName, baseline, mealPattern } = requestData;

    // Verify the email belongs to the authenticated user
    if (email !== userEmail) {
      console.error('[SEND-BASELINE-EMAIL] Email mismatch - requested:', email, 'user:', userEmail);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cannot send email to a different address' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SEND-BASELINE-EMAIL] Sending baseline email to:', email);

    // Format goal label
    const goalLabels: Record<string, string> = {
      fat_loss: 'Fat Loss',
      muscle_gain: 'Muscle Gain',
      performance: 'Performance Optimization',
      recovery: 'Recovery & Wellness',
      energy: 'Energy & Vitality',
      health_markers: 'Health Markers',
      general_health: 'General Health',
    };

    const goalLabel = goalLabels[baseline.primaryGoal] || 'Your Goals';

    // Calculate macro percentages
    const totalCalories = baseline.targetCalories;
    const proteinCals = baseline.proteinGrams * 4;
    const carbsCals = baseline.carbsGrams * 4;
    const fatsCals = baseline.fatsGrams * 9;
    
    const proteinPct = Math.round((proteinCals / totalCalories) * 100);
    const carbsPct = Math.round((carbsCals / totalCalories) * 100);
    const fatsPct = Math.round((fatsCals / totalCalories) * 100);

    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your CJT Nutrition Baseline</title>
</head>
<body style="font-family: 'Nunito', Arial, sans-serif; background-color: #f8f7f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">CJT Nutrition</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Nutrition with intention</p>
    </div>

    <div style="padding: 32px;">
      <!-- Welcome -->
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px;">
        ${userName ? `Hi ${userName}! 👋` : 'Welcome! 👋'}
      </h2>
      <p style="color: #6b7280; line-height: 1.6; margin: 0 0 24px 0;">
        Your personalized nutrition baseline is ready. This is your starting point for <strong>${goalLabel}</strong> — designed specifically for you based on your profile.
      </p>

      <!-- Get Started Instructions -->
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
        <h3 style="color: #166534; margin: 0 0 16px 0; font-size: 18px;">📲 Get the Best Experience</h3>
        <p style="color: #15803d; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; font-weight: 600;">Step 1: Add MacNutrition to your Home Screen</p>
        <ul style="color: #166534; font-size: 13px; line-height: 1.8; margin: 0 0 16px 16px; padding: 0;">
          <li><strong>iPhone:</strong> Open <a href="https://macnutrition.lovable.app" style="color: #22c55e;">macnutrition.lovable.app</a> in Safari → tap the Share button → "Add to Home Screen"</li>
          <li><strong>Android:</strong> Open in Chrome → tap the menu (⋮) → "Add to Home Screen" or "Install App"</li>
        </ul>
        <p style="color: #15803d; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; font-weight: 600;">Step 2: Turn on Push Notifications</p>
        <p style="color: #166534; font-size: 13px; line-height: 1.6; margin: 0;">
          Open the app from your Home Screen → go to your <strong>Profile</strong> tab → scroll to <strong>Reminders</strong> → toggle on <strong>Push Notifications</strong>. This way you'll get daily reminders to log meals, hydration, and check-ins!
        </p>
      </div>

      <!-- Share on Instagram -->
      <div style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #fbcfe8;">
        <h3 style="color: #9d174d; margin: 0 0 12px 0; font-size: 18px;">📸 Loving MacNutrition? Share it!</h3>
        <p style="color: #831843; font-size: 13px; line-height: 1.6; margin: 0;">
          If you're enjoying your experience, we'd love to see it! Share your journey on your Instagram Stories and tag us <strong style="color: #be185d;">@macnutrition</strong> — we'll share our favourites! 💚
        </p>
      </div>

      <!-- Calorie Target Card -->
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">DAILY CALORIE TARGET</p>
        <p style="color: #78350f; font-size: 48px; font-weight: 700; margin: 0;">${baseline.targetCalories.toLocaleString()}</p>
        <p style="color: #92400e; font-size: 14px; margin: 8px 0 0 0;">calories per day</p>
      </div>

      <!-- Macro Breakdown -->
      <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">📊 Macro Breakdown</h3>
      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #fef2f2; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #dc2626; font-size: 24px; font-weight: 700; margin: 0;">${baseline.proteinGrams}g</p>
          <p style="color: #991b1b; font-size: 12px; margin: 4px 0 0 0;">Protein (${proteinPct}%)</p>
        </div>
        <div style="flex: 1; background: #eff6ff; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #2563eb; font-size: 24px; font-weight: 700; margin: 0;">${baseline.carbsGrams}g</p>
          <p style="color: #1e40af; font-size: 12px; margin: 4px 0 0 0;">Carbs (${carbsPct}%)</p>
        </div>
        <div style="flex: 1; background: #fefce8; border-radius: 12px; padding: 16px; text-align: center;">
          <p style="color: #ca8a04; font-size: 24px; font-weight: 700; margin: 0;">${baseline.fatsGrams}g</p>
          <p style="color: #854d0e; font-size: 12px; margin: 4px 0 0 0;">Fats (${fatsPct}%)</p>
        </div>
      </div>

      <!-- Hydration -->
      <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">💧 Daily Hydration</h3>
      <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #1e40af;">Water</span>
          <span style="color: #1e40af; font-weight: 700;">${baseline.waterLiters.toFixed(1)}L</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #6b7280;">Sodium</span>
          <span style="color: #374151; font-weight: 600;">${baseline.sodiumMg}mg</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #6b7280;">Magnesium</span>
          <span style="color: #374151; font-weight: 600;">${baseline.magnesiumMg}mg</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Potassium</span>
          <span style="color: #374151; font-weight: 600;">${baseline.potassiumMg}mg</span>
        </div>
      </div>

      <!-- Meal Pattern -->
      <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">🍽️ Suggested Meal Pattern</h3>
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        ${mealPattern.map((meal, i) => `
          <div style="display: flex; align-items: center; padding: 12px 0; ${i < mealPattern.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
            <div style="width: 32px; height: 32px; background: #22c55e; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; margin-right: 12px;">${i + 1}</div>
            <div style="flex: 1;">
              <p style="margin: 0; color: #1f2937; font-weight: 600;">${meal.meal}</p>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${meal.purpose}</p>
            </div>
            <span style="color: #9ca3af; font-size: 13px;">${meal.time}</span>
          </div>
        `).join('')}
      </div>

      <!-- Focus Points -->
      <h3 style="color: #1f2937; margin: 0 0 16px 0; font-size: 18px;">🎯 This Week's Focus</h3>
      <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        ${baseline.focusPoints.map((point, i) => `
          <div style="display: flex; align-items: flex-start; margin-bottom: ${i < baseline.focusPoints.length - 1 ? '16px' : '0'};">
            <span style="color: #22c55e; margin-right: 12px; font-size: 18px;">✓</span>
            <p style="margin: 0; color: #166534; line-height: 1.5;">${point}</p>
          </div>
        `).join('')}
      </div>

      <!-- Reminder -->
      <div style="background: #fafaf9; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e7e5e4;">
        <p style="color: #78716c; font-size: 14px; margin: 0; line-height: 1.6;">
          <strong style="color: #57534e;">Remember:</strong> Your goal is consistency, not perfection.<br>
          The app adapts with you — just keep logging and checking in!
        </p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 32px;">
        <a href="https://cjtnutrition.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          Open CJT Nutrition →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        This baseline adapts every 2 weeks based on your progress and check-ins.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
        CJT Nutrition • Nutrition with intention
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Plain text version
    const textContent = `
CJT Nutrition - Your Personalized Baseline

${userName ? `Hi ${userName}!` : 'Welcome!'}

Your personalized nutrition baseline is ready for ${goalLabel}.

📲 GET THE BEST EXPERIENCE:
Step 1: Add MacNutrition to your Home Screen
• iPhone: Open macnutrition.lovable.app in Safari → tap Share → "Add to Home Screen"
• Android: Open in Chrome → tap menu (⋮) → "Add to Home Screen" or "Install App"

Step 2: Turn on Push Notifications
Open the app from your Home Screen → Profile tab → Reminders → toggle on Push Notifications.

📸 LOVING MACNUTRITION? SHARE IT!
Share your journey on Instagram Stories and tag @macnutrition — we'd love to see it!

DAILY TARGETS:
• Calories: ${baseline.targetCalories} kcal
• Protein: ${baseline.proteinGrams}g (${proteinPct}%)
• Carbs: ${baseline.carbsGrams}g (${carbsPct}%)
• Fats: ${baseline.fatsGrams}g (${fatsPct}%)

HYDRATION:
• Water: ${baseline.waterLiters.toFixed(1)}L
• Sodium: ${baseline.sodiumMg}mg
• Magnesium: ${baseline.magnesiumMg}mg
• Potassium: ${baseline.potassiumMg}mg

MEAL PATTERN:
${mealPattern.map((meal, i) => `${i + 1}. ${meal.meal} (${meal.time}) - ${meal.purpose}`).join('\n')}

THIS WEEK'S FOCUS:
${baseline.focusPoints.map(point => `• ${point}`).join('\n')}

Remember: Your goal is consistency, not perfection. The app adapts with you — just keep logging and checking in!

Open the app: https://cjtnutrition.lovable.app

This baseline adapts every 2 weeks based on your progress.
CJT Nutrition • Nutrition with intention
    `;

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'CJT Nutrition <onboarding@resend.dev>',
        to: [email],
        subject: '🎯 Your Personalized Nutrition Baseline is Ready!',
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error('[SEND-BASELINE-EMAIL] Resend API error:', res.status, errorBody);
      throw new Error(`Failed to send email: ${res.status}`);
    }

    const result = await res.json();
    console.log('[SEND-BASELINE-EMAIL] Email sent successfully:', result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEND-BASELINE-EMAIL] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
