import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TRIAL-REMINDER] ${step}${detailsStr}`);
};

interface TrialReminderRequest {
  email: string;
  firstName?: string;
  daysRemaining: number;
  trialEndDate: string;
}

const generateEmailHtml = (daysRemaining: number, trialEndDate: string, firstName?: string) => {
  const formattedDate = new Date(trialEndDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isUrgent = daysRemaining <= 3;
  const greeting = firstName ? `Hi ${firstName}! 👋` : 'Hi there! 👋';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${isUrgent ? '#ef4444' : '#f59e0b'} 0%, ${isUrgent ? '#f97316' : '#eab308'} 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">
              ${isUrgent ? '⏰ Your Trial Expires Soon!' : '📅 Trial Reminder'}
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px;">
              ${greeting}
            </p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px;">
              Just a friendly reminder that your <strong>MacNutrition</strong> free trial 
              ${isUrgent 
                ? `<span style="color: #ef4444; font-weight: bold;">expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}!</span>` 
                : `has <strong>${daysRemaining} days</strong> remaining.`}
            </p>
            
            <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Trial ends on:</p>
              <p style="margin: 8px 0 0; color: #1e293b; font-size: 18px; font-weight: 600;">${formattedDate}</p>
            </div>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 24px;">
              Don't lose access to:
            </p>
            
            <ul style="padding-left: 20px; margin: 0 0 24px;">
              <li style="color: #374151; margin-bottom: 8px;">🤖 AI Nutrition Coach</li>
              <li style="color: #374151; margin-bottom: 8px;">🍽️ Personalized Meal Plans</li>
              <li style="color: #374151; margin-bottom: 8px;">📊 Progress Tracking</li>
              <li style="color: #374151; margin-bottom: 8px;">⌚ Wearable Integration</li>
            </ul>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="https://macnutrition.lovable.app" 
                 style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Upgrade Now →
              </a>
            </div>
            
            <p style="font-size: 14px; color: #9ca3af; line-height: 1.6; margin: 24px 0 0; text-align: center;">
              Questions? Just reply to this email — we're happy to help!
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
              MacNutrition • Your Personal Nutrition Coach
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: internal-only (called by check-trial-reminders cron).
  // Require service-role bearer to prevent open email abuse.
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceRole || authHeader !== `Bearer ${serviceRole}`) {
    logStep("Unauthorized request blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    logStep("Function started");


    const { email, firstName, daysRemaining, trialEndDate }: TrialReminderRequest = await req.json();

    if (!email || daysRemaining === undefined || !trialEndDate) {
      throw new Error("Missing required fields: email, daysRemaining, trialEndDate");
    }

    logStep("Sending reminder email", { email, firstName, daysRemaining });

    const isUrgent = daysRemaining <= 3;
    const subject = isUrgent 
      ? `⏰ Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}!`
      : `📅 ${daysRemaining} days left in your MacNutrition trial`;

    const emailResponse = await resend.emails.send({
      from: "MacNutrition <onboarding@resend.dev>",
      to: [email],
      subject,
      html: generateEmailHtml(daysRemaining, trialEndDate, firstName),
    });

    logStep("Email sent successfully", { emailResponse });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
