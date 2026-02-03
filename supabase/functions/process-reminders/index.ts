import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserReminder {
  user_id: string;
  email: string;
  name: string | null;
  reminders_enabled: boolean;
  reminder_meal_logging: boolean;
  reminder_water_logging: boolean;
  reminder_weekly_summary: boolean;
  reminder_frequency: string;
  reminder_time: string;
  reminder_timezone: string;
  reminder_quiet_start: string;
  reminder_quiet_end: string;
  last_meal_reminder_sent: string | null;
  last_water_reminder_sent: string | null;
  last_weekly_summary_sent: string | null;
}

const isWithinQuietHours = (
  timezone: string, 
  quietStart: string, 
  quietEnd: string
): boolean => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [quietStartHour, quietStartMinute] = quietStart.split(':').map(Number);
    const [quietEndHour, quietEndMinute] = quietEnd.split(':').map(Number);
    const quietStartMinutes = quietStartHour * 60 + quietStartMinute;
    const quietEndMinutes = quietEndHour * 60 + quietEndMinute;

    // Handle overnight quiet hours (e.g., 21:00 - 07:00)
    if (quietStartMinutes > quietEndMinutes) {
      return currentMinutes >= quietStartMinutes || currentMinutes < quietEndMinutes;
    }
    return currentMinutes >= quietStartMinutes && currentMinutes < quietEndMinutes;
  } catch (error) {
    console.error("Error checking quiet hours:", error);
    return false;
  }
};

const isTimeToSend = (
  timezone: string,
  preferredTime: string
): boolean => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTime = formatter.format(now);
    const [currentHour] = currentTime.split(':').map(Number);
    const [preferredHour] = preferredTime.split(':').map(Number);
    
    // Allow a 1-hour window for the reminder
    return currentHour === preferredHour;
  } catch (error) {
    console.error("Error checking time:", error);
    return false;
  }
};

const shouldSendReminder = (
  frequency: string,
  lastSent: string | null,
  isWeekly: boolean = false
): boolean => {
  if (!lastSent) return true;

  const lastSentDate = new Date(lastSent);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);

  if (isWeekly) {
    return hoursDiff >= 24 * 7; // 7 days
  }

  switch (frequency) {
    case "daily":
      return hoursDiff >= 20; // At least 20 hours apart
    case "twice_daily":
      return hoursDiff >= 10; // At least 10 hours apart
    case "weekly":
      return hoursDiff >= 24 * 7;
    default:
      return hoursDiff >= 20;
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[PROCESS-REMINDERS] Starting reminder processing...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with reminders enabled
    const { data: users, error: fetchError } = await supabase
      .from("user_baselines")
      .select(`
        user_id,
        name,
        reminders_enabled,
        reminder_meal_logging,
        reminder_water_logging,
        reminder_weekly_summary,
        reminder_frequency,
        reminder_time,
        reminder_timezone,
        reminder_quiet_start,
        reminder_quiet_end,
        last_meal_reminder_sent,
        last_water_reminder_sent,
        last_weekly_summary_sent
      `)
      .eq("reminders_enabled", true);

    if (fetchError) {
      console.error("[PROCESS-REMINDERS] Error fetching users:", fetchError);
      throw fetchError;
    }

    console.log(`[PROCESS-REMINDERS] Found ${users?.length || 0} users with reminders enabled`);

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;

    for (const user of users) {
      const timezone = user.reminder_timezone || "America/New_York";
      const quietStart = user.reminder_quiet_start || "21:00";
      const quietEnd = user.reminder_quiet_end || "07:00";
      const preferredTime = user.reminder_time || "09:00";
      const frequency = user.reminder_frequency || "daily";

      // Skip if in quiet hours
      if (isWithinQuietHours(timezone, quietStart, quietEnd)) {
        console.log(`[PROCESS-REMINDERS] Skipping ${user.user_id} - quiet hours`);
        continue;
      }

      // Skip if not the right time
      if (!isTimeToSend(timezone, preferredTime)) {
        console.log(`[PROCESS-REMINDERS] Skipping ${user.user_id} - not preferred time`);
        continue;
      }

      // Get user email from auth
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.user_id);
      if (authError || !authUser?.user?.email) {
        console.error(`[PROCESS-REMINDERS] Could not get email for user ${user.user_id}`);
        continue;
      }

      const email = authUser.user.email;

      // Process meal reminder
      if (user.reminder_meal_logging && shouldSendReminder(frequency, user.last_meal_reminder_sent)) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-reminder-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "meal",
              userId: user.user_id,
              email,
              userName: user.name,
            }),
          });

          if (response.ok) {
            await supabase
              .from("user_baselines")
              .update({ last_meal_reminder_sent: new Date().toISOString() })
              .eq("user_id", user.user_id);
            sentCount++;
            console.log(`[PROCESS-REMINDERS] Sent meal reminder to ${email}`);
          }
        } catch (error) {
          console.error(`[PROCESS-REMINDERS] Failed to send meal reminder:`, error);
        }
      }

      // Process water reminder
      if (user.reminder_water_logging && shouldSendReminder(frequency, user.last_water_reminder_sent)) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-reminder-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "water",
              userId: user.user_id,
              email,
              userName: user.name,
            }),
          });

          if (response.ok) {
            await supabase
              .from("user_baselines")
              .update({ last_water_reminder_sent: new Date().toISOString() })
              .eq("user_id", user.user_id);
            sentCount++;
            console.log(`[PROCESS-REMINDERS] Sent water reminder to ${email}`);
          }
        } catch (error) {
          console.error(`[PROCESS-REMINDERS] Failed to send water reminder:`, error);
        }
      }

      // Process weekly summary (always weekly regardless of frequency setting)
      if (user.reminder_weekly_summary && shouldSendReminder("weekly", user.last_weekly_summary_sent, true)) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-reminder-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "weekly_summary",
              userId: user.user_id,
              email,
              userName: user.name,
            }),
          });

          if (response.ok) {
            await supabase
              .from("user_baselines")
              .update({ last_weekly_summary_sent: new Date().toISOString() })
              .eq("user_id", user.user_id);
            sentCount++;
            console.log(`[PROCESS-REMINDERS] Sent weekly summary to ${email}`);
          }
        } catch (error) {
          console.error(`[PROCESS-REMINDERS] Failed to send weekly summary:`, error);
        }
      }
    }

    console.log(`[PROCESS-REMINDERS] Completed. Processed ${users.length} users, sent ${sentCount} reminders`);

    return new Response(
      JSON.stringify({ processed: users.length, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[PROCESS-REMINDERS] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
