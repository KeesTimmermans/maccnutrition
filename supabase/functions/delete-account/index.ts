import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DELETE-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Use service role to perform privileged deletions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate the requesting user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    const userId = user.id;
    const userEmail = user.email;
    logStep("User authenticated", { userId, email: userEmail });

    // 1. Cancel all active Stripe subscriptions
    if (userEmail) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

        if (customers.data.length > 0) {
          const customerId = customers.data[0].id;
          logStep("Found Stripe customer", { customerId });

          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
          });

          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id);
            logStep("Cancelled subscription", { subscriptionId: sub.id });
          }

          // Also cancel trialing subscriptions
          const trialing = await stripe.subscriptions.list({
            customer: customerId,
            status: "trialing",
          });
          for (const sub of trialing.data) {
            await stripe.subscriptions.cancel(sub.id);
            logStep("Cancelled trialing subscription", { subscriptionId: sub.id });
          }
        } else {
          logStep("No Stripe customer found, skipping subscription cancellation");
        }
      } catch (stripeErr) {
        // Non-fatal — log and continue with data deletion
        logStep("Stripe cancellation error (non-fatal)", { error: String(stripeErr) });
      }
    }

    // 2. Delete all user data from public tables (order avoids FK issues)
    const tables = [
      "consent_log",
      "push_subscriptions",
      "push_daily_log",
      "email_daily_log",
      "water_intake",
      "meals",
      "favorite_meals",
      "meal_plans",
      "daily_checkins",
      "progress_updates",
      "coach_conversations",
      "user_streaks",
      "wearable_tokens",     // child of wearable_connections
      "wearable_connections",
      "wearable_data",
      "user_baselines",
      "profiles",
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId);
      if (error) {
        logStep(`Warning: could not delete from ${table}`, { error: error.message });
      } else {
        logStep(`Deleted rows from ${table}`);
      }
    }

    // 3. Delete the auth user (cascades anything remaining)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    logStep("Auth user deleted", { userId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
