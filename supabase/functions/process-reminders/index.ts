import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Return the current hour (0-23) in the user's timezone */
const getUserLocalHour = (timezone: string): number => {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    });
    return Number(fmt.format(new Date()));
  } catch {
    return -1;
  }
};

/** Return today's date string (YYYY-MM-DD) in the user's timezone */
const getUserLocalDate = (timezone: string): string => {
  try {
    const d = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
    return parts; // en-CA gives YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: cron-only endpoint. Require the service-role bearer to
  // prevent unauthenticated mass email triggering.
  const serviceRoleAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!serviceRoleAuth || authHeader !== `Bearer ${serviceRoleAuth}`) {
    console.warn("[PROCESS-REMINDERS] Unauthorized request blocked");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[PROCESS-REMINDERS] Starting...");


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch users with email reminders enabled
    const { data: users, error: fetchErr } = await supabase
      .from("user_baselines")
      .select("user_id, name, reminders_enabled, reminder_frequency, reminder_timezone")
      .eq("reminders_enabled", true);

    if (fetchErr) throw fetchErr;
    console.log(`[PROCESS-REMINDERS] ${users?.length ?? 0} users with reminders enabled`);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const user of users) {
      const tz = user.reminder_timezone || "Europe/London";
      const freq = user.reminder_frequency || "standard"; // "light" or "standard"
      const localHour = getUserLocalHour(tz);
      const localDate = getUserLocalDate(tz);

      // Quiet hours: only send 7-20 (7AM-8:59PM)
      if (localHour < 7 || localHour >= 21) continue;

      // Get or create today's email log
      let { data: logRow } = await supabase
        .from("email_daily_log")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("log_date", localDate)
        .maybeSingle();

      if (!logRow) {
        const { data: created } = await supabase
          .from("email_daily_log")
          .insert({ user_id: user.user_id, log_date: localDate })
          .select()
          .single();
        logRow = created;
      }
      if (!logRow) continue;

      // Get user email
      const { data: authUser } = await supabase.auth.admin.getUserById(user.user_id);
      if (!authUser?.user?.email) continue;
      const email = authUser.user.email;
      const displayName = user.name || "there";

      // --- MORNING CHECK-IN (7 AM hour) ---
      if (localHour === 7 && !logRow.morning_sent) {
        // Check if daily check-in exists for today
        const { data: checkins } = await supabase
          .from("daily_checkins")
          .select("id")
          .eq("user_id", user.user_id)
          .eq("check_in_date", localDate)
          .limit(1);

        if (!checkins || checkins.length === 0) {
          const ok = await sendEmail(supabaseUrl, serviceKey, {
            type: "meal",
            userId: user.user_id,
            email,
            userName: displayName,
          });
          if (ok) {
            await supabase
              .from("email_daily_log")
              .update({ morning_sent: true, updated_at: new Date().toISOString() })
              .eq("id", logRow.id);
            sentCount++;
            console.log(`[PROCESS-REMINDERS] Morning email sent to ${email}`);
          }
        }
      }

      // --- DAYTIME FOLLOW-UPS (11AM+, standard mode only) ---
      if (freq === "light") continue; // Light = morning only
      if (localHour < 11) continue;
      if (logRow.followup_count >= 2) continue;

      // Check activity: has user logged a meal or water today?
      const todayStart = `${localDate}T00:00:00`;
      const [{ data: meals }, { data: water }] = await Promise.all([
        supabase.from("meals").select("id").eq("user_id", user.user_id).gte("logged_at", todayStart).limit(1),
        supabase.from("water_intake").select("id").eq("user_id", user.user_id).gte("logged_at", todayStart).limit(1),
      ]);

      const hasLogged = (meals && meals.length > 0) || (water && water.length > 0);
      if (hasLogged) continue;

      // Check 3-hour gap
      if (logRow.last_followup_at) {
        const hoursSince = (Date.now() - new Date(logRow.last_followup_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 3) continue;
      }

      const ok = await sendEmail(supabaseUrl, serviceKey, {
        type: "water", // "keep tracking" email
        userId: user.user_id,
        email,
        userName: displayName,
      });
      if (ok) {
        await supabase
          .from("email_daily_log")
          .update({
            followup_count: logRow.followup_count + 1,
            last_followup_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", logRow.id);
        sentCount++;
        console.log(`[PROCESS-REMINDERS] Follow-up #${logRow.followup_count + 1} sent to ${email}`);
      }
    }

    console.log(`[PROCESS-REMINDERS] Done. Sent ${sentCount} emails.`);
    return new Response(JSON.stringify({ processed: users.length, sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[PROCESS-REMINDERS] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

async function sendEmail(
  supabaseUrl: string,
  serviceKey: string,
  body: { type: string; userId: string; email: string; userName: string }
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-reminder-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    console.error("[PROCESS-REMINDERS] sendEmail failed:", e);
    return false;
  }
}

serve(handler);
