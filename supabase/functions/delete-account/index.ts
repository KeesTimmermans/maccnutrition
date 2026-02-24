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

    const requestingUser = userData.user;
    logStep("Requester authenticated", { requesterId: requestingUser.id });

    // Check if a target_user_id was provided (admin deleting another user)
    let body: { target_user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body = self-deletion
    }

    let targetUserId = requestingUser.id;
    let targetEmail = requestingUser.email;

    if (body.target_user_id && body.target_user_id !== requestingUser.id) {
      // Verify the requester is an admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", requestingUser.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        throw new Error("Forbidden: admin role required to delete other accounts");
      }

      targetUserId = body.target_user_id;

      // Get target user's email for Stripe cleanup
      const { data: targetUserData } = await supabase.auth.admin.getUserById(targetUserId);
      targetEmail = targetUserData?.user?.email ?? null;
      logStep("Admin deletion requested", { adminId: requestingUser.id, targetUserId, targetEmail });
    } else {
      logStep("Self-deletion requested", { userId: targetUserId, email: targetEmail });
    }

    // 1. Cancel all active Stripe subscriptions
    if (targetEmail) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: targetEmail, limit: 1 });

        if (customers.data.length > 0) {
          const customerId = customers.data[0].id;
          logStep("Found Stripe customer", { customerId });

          const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active" });
          for (const sub of subscriptions.data) {
            await stripe.subscriptions.cancel(sub.id);
            logStep("Cancelled subscription", { subscriptionId: sub.id });
          }

          const trialing = await stripe.subscriptions.list({ customer: customerId, status: "trialing" });
          for (const sub of trialing.data) {
            await stripe.subscriptions.cancel(sub.id);
            logStep("Cancelled trialing subscription", { subscriptionId: sub.id });
          }
        } else {
          logStep("No Stripe customer found, skipping subscription cancellation");
        }
      } catch (stripeErr) {
        logStep("Stripe cancellation error (non-fatal)", { error: String(stripeErr) });
      }
    }

    // 2. Delete all user data from public tables
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
      "community_likes",
      "community_comments",
      "community_posts",
      "community_reports",
      "wearable_tokens",
      "wearable_connections",
      "wearable_data",
      "user_roles",
      "user_baselines",
      "profiles",
    ];

    for (const table of tables) {
      const col = table === "community_reports" ? "reporter_user_id" : "user_id";
      const { error } = await supabase.from(table).delete().eq(col, targetUserId);
      if (error) {
        logStep(`Warning: could not delete from ${table}`, { error: error.message });
      } else {
        logStep(`Deleted rows from ${table}`);
      }
    }

    // 3. Delete the auth user
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(targetUserId);
    if (deleteUserError) throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    logStep("Auth user deleted", { targetUserId });

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
