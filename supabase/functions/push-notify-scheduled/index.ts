import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushSubscription,
  type PushMessage,
  type VapidKeys,
} from "https://esm.sh/@block65/webcrypto-web-push@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Get current hour in a timezone (0-23) */
const getLocalHour = (timezone: string): number => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === "hour")!.value);
  } catch {
    return -1; // invalid tz → skip user
  }
};

/** Get today's date string (YYYY-MM-DD) in a timezone */
const getLocalDateStr = (timezone: string): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA → YYYY-MM-DD
};

/** Send a push to one subscription, return success boolean */
const sendPush = async (
  sub: { id: string; endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: { title: string; body: string; url?: string },
  vapid: VapidKeys,
  supabase: any
): Promise<boolean> => {
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
  };

  const message: PushMessage = {
    data: JSON.stringify(payload),
    options: { ttl: 3600 },
  };

  try {
    const pushPayload = await buildPushPayload(message, subscription, vapid);
    const res = await fetch(subscription.endpoint, pushPayload);

    // Clean up gone subscriptions
    if (res.status === 404 || res.status === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    return res.ok;
  } catch (e) {
    console.error(`[PUSH-SCHED] send error for ${sub.endpoint}:`, e.message);
    return false;
  }
};

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const vapid: VapidKeys = {
    subject: Deno.env.get("VAPID_SUBJECT") || "mailto:hello@cjtnutrition.com",
    publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
    privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
  };

  console.log("[PUSH-SCHED] Starting scheduled push check…");

  try {
    // 1. Get all users who have push subscriptions
    const { data: subscriptions, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("user_id, id, endpoint, keys_p256dh, keys_auth");

    if (subErr) throw subErr;
    if (!subscriptions || subscriptions.length === 0) {
      return json({ processed: 0, morning: 0, followup: 0 });
    }

    // Group subscriptions by user_id
    const userSubs = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const list = userSubs.get(sub.user_id) || [];
      list.push(sub);
      userSubs.set(sub.user_id, list);
    }

    const userIds = [...userSubs.keys()];

    // 2. Get user timezones
    const { data: baselines } = await supabase
      .from("user_baselines")
      .select("user_id, reminder_timezone, name")
      .in("user_id", userIds);

    const tzMap = new Map<string, { tz: string; name: string | null }>();
    for (const b of baselines || []) {
      tzMap.set(b.user_id, {
        tz: b.reminder_timezone || "Europe/London",
        name: b.name,
      });
    }

    let morningSent = 0;
    let followupSent = 0;

    for (const userId of userIds) {
      const { tz: timezone } = tzMap.get(userId) || { tz: "Europe/London" };
      const localHour = getLocalHour(timezone);
      if (localHour < 0) continue; // bad tz

      // Quiet hours: only 7 AM – 9 PM
      if (localHour < 7 || localHour >= 21) {
        continue;
      }

      const todayStr = getLocalDateStr(timezone);
      const subs = userSubs.get(userId)!;

      // 3. Get or create today's push log
      let { data: logRow } = await supabase
        .from("push_daily_log")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", todayStr)
        .maybeSingle();

      if (!logRow) {
        const { data: newRow } = await supabase
          .from("push_daily_log")
          .insert({ user_id: userId, log_date: todayStr })
          .select()
          .single();
        logRow = newRow;
      }
      if (!logRow) continue;

      // ── MORNING CHECK-IN (7 AM window) ──
      if (localHour === 7 && !logRow.morning_sent) {
        // Check if user already completed daily check-in
        const { data: checkins } = await supabase
          .from("daily_checkins")
          .select("id")
          .eq("user_id", userId)
          .eq("check_in_date", todayStr)
          .limit(1);

        if (!checkins || checkins.length === 0) {
          // Send morning push to all user devices
          let sent = false;
          for (const sub of subs) {
            const ok = await sendPush(
              sub,
              {
                title: "☀️ Good morning!",
                body: "Start your day right — complete your morning check-in.",
                url: "/#/",
              },
              vapid,
              supabase
            );
            if (ok) sent = true;
          }
          if (sent) {
            await supabase
              .from("push_daily_log")
              .update({ morning_sent: true, updated_at: new Date().toISOString() })
              .eq("id", logRow.id);
            morningSent++;
            console.log(`[PUSH-SCHED] Morning push sent to ${userId}`);
          }
        }
      }

      // ── DAYTIME FOLLOW-UPS (11 AM – 9 PM) ──
      if (localHour >= 11 && logRow.followup_count < 4) {
        // Check if user logged any meal or water today
        const todayStart = `${todayStr}T00:00:00`;

        const [{ data: meals }, { data: water }] = await Promise.all([
          supabase
            .from("meals")
            .select("id")
            .eq("user_id", userId)
            .gte("logged_at", todayStart)
            .limit(1),
          supabase
            .from("water_intake")
            .select("id")
            .eq("user_id", userId)
            .gte("logged_at", todayStart)
            .limit(1),
        ]);

        const hasLogged =
          (meals && meals.length > 0) || (water && water.length > 0);

        if (hasLogged) {
          // User already active today — skip all follow-ups
          continue;
        }

        // Check 3-hour gap since last follow-up
        if (logRow.last_followup_at) {
          const hoursSince =
            (Date.now() - new Date(logRow.last_followup_at).getTime()) /
            (1000 * 60 * 60);
          if (hoursSince < 3) continue;
        }

        // Send follow-up push
        const bodies = [
          "Don't forget to log your meals and water today! 💧🍽️",
          "A quick log keeps you on track — add a meal or water now.",
          "Still time to track today! Log something to keep your streak.",
          "Your nutrition coach is waiting — log a meal or water to stay on target.",
        ];
        const bodyText = bodies[logRow.followup_count] || bodies[0];

        let sent = false;
        for (const sub of subs) {
          const ok = await sendPush(
            sub,
            {
              title: "📋 Tracking Reminder",
              body: bodyText,
              url: "/#/meals",
            },
            vapid,
            supabase
          );
          if (ok) sent = true;
        }

        if (sent) {
          await supabase
            .from("push_daily_log")
            .update({
              followup_count: logRow.followup_count + 1,
              last_followup_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", logRow.id);
          followupSent++;
          console.log(
            `[PUSH-SCHED] Follow-up #${logRow.followup_count + 1} sent to ${userId}`
          );
        }
      }
    }

    console.log(
      `[PUSH-SCHED] Done. Morning: ${morningSent}, Follow-up: ${followupSent}`
    );
    return json({ processed: userIds.length, morning: morningSent, followup: followupSent });
  } catch (e: any) {
    console.error("[PUSH-SCHED] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
