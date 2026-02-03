import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  type: "meal" | "water" | "weekly_summary";
  userId: string;
  email: string;
  userName?: string;
  unsubscribeToken?: string;
}

const generateUnsubscribeUrl = (userId: string) => {
  const baseUrl = Deno.env.get("SITE_URL") || "https://macnutrition.lovable.app";
  return `${baseUrl}/settings?unsubscribe=reminders&user=${userId}`;
};

const getMealReminderHtml = (userName: string, unsubscribeUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-bottom: 16px;">Hey ${userName}! 🍽️</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Just a friendly reminder to log your meals today! Tracking your nutrition helps you stay on top of your goals.
    </p>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Haven't logged anything yet? It only takes a few seconds!
    </p>
    <a href="https://macnutrition.lovable.app" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
      Log Your Meals
    </a>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">
      <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe from reminders</a>
    </p>
  </div>
</body>
</html>
`;

const getWaterReminderHtml = (userName: string, unsubscribeUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-bottom: 16px;">Stay Hydrated! 💧</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Hey ${userName}, this is your daily water reminder! Proper hydration is key to feeling your best.
    </p>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Don't forget to track your water intake today.
    </p>
    <a href="https://macnutrition.lovable.app" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
      Track Water Intake
    </a>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">
      <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe from reminders</a>
    </p>
  </div>
</body>
</html>
`;

const getWeeklySummaryHtml = (userName: string, unsubscribeUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; margin-bottom: 16px;">Your Weekly Progress 📊</h1>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Hey ${userName}! Another week has passed. Time to check in on your progress!
    </p>
    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
      Log in to see your weekly nutrition summary, track your trends, and plan for the week ahead.
    </p>
    <a href="https://macnutrition.lovable.app/progress" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;">
      View Progress
    </a>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">
      <a href="${unsubscribeUrl}" style="color: #888;">Unsubscribe from reminders</a>
    </p>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, userId, email, userName }: ReminderRequest = await req.json();
    
    console.log(`[SEND-REMINDER] Sending ${type} reminder to ${email}`);
    
    const unsubscribeUrl = generateUnsubscribeUrl(userId);
    const displayName = userName || "there";
    
    let subject: string;
    let html: string;

    switch (type) {
      case "meal":
        subject = "🍽️ Don't forget to log your meals!";
        html = getMealReminderHtml(displayName, unsubscribeUrl);
        break;
      case "water":
        subject = "💧 Hydration reminder!";
        html = getWaterReminderHtml(displayName, unsubscribeUrl);
        break;
      case "weekly_summary":
        subject = "📊 Your weekly nutrition summary is ready";
        html = getWeeklySummaryHtml(displayName, unsubscribeUrl);
        break;
      default:
        throw new Error(`Unknown reminder type: ${type}`);
    }

    const { data, error } = await resend.emails.send({
      from: "CJT Nutrition <reminders@cjtprogramming.com>",
      to: [email],
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (error) {
      console.error(`[SEND-REMINDER] Failed to send ${type} reminder:`, error);
      throw error;
    }

    console.log(`[SEND-REMINDER] Successfully sent ${type} reminder to ${email}`);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[SEND-REMINDER] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
