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
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Get user's push subscriptions
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subsError) throw subsError;
    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No push subscriptions found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const vapid: VapidKeys = {
      subject: Deno.env.get("VAPID_SUBJECT") || "mailto:hello@cjtnutrition.com",
      publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
      privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
    };

    const message: PushMessage = {
      data: JSON.stringify({
        title: "🎉 CJTNutrition",
        body: "Push notifications are working! Don't forget to log your meals today.",
        icon: "/favicon.ico",
        url: "/#/",
      }),
      options: { ttl: 60 },
    };

    const results = [];
    for (const sub of subs) {
      const subscription: PushSubscription = {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      try {
        // buildPushPayload returns a Request-like object with RFC 8291
        // aes128gcm encrypted body + proper VAPID headers
        const pushPayload = await buildPushPayload(
          message,
          subscription,
          vapid
        );

        const res = await fetch(subscription.endpoint, pushPayload);
        const responseText = res.ok ? "" : await res.text().catch(() => "");

        results.push({
          endpoint: sub.endpoint,
          status: res.status,
          ok: res.ok,
          ...(responseText && { detail: responseText }),
        });

        // Clean up expired/gone subscriptions
        if (res.status === 404 || res.status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }
      } catch (e) {
        results.push({
          endpoint: sub.endpoint,
          error: e.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        sent: results,
        encoding: "aes128gcm",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("push-send-test error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
