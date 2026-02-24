import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const isoFromUnixSeconds = (value: unknown): string | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Date(n * 1000).toISOString();
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Only fetch active/trialing subscriptions to reduce API overhead
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    // If no active, check for trialing separately only if needed
    let trialingSubs = { data: [] as any[] };
    if (subscriptions.data.length === 0) {
      trialingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
    }

    // Combine results - active subs take priority
    const activeOrTrialing = subscriptions.data.length > 0 
      ? subscriptions.data 
      : trialingSubs.data;

    const hasActiveSub = activeOrTrialing.length > 0;
    let subscriptionEnd: string | null = null;
    let isTrialing = false;
    let trialEnd: string | null = null;
    let trialDaysRemaining: number | null = null;

    if (hasActiveSub) {
      const subscription = activeOrTrialing[0];

      // Guard against Stripe returning null/undefined/string timestamps (prevents "Invalid time value")
      subscriptionEnd = isoFromUnixSeconds((subscription as any).current_period_end);
      isTrialing = subscription.status === "trialing";

      if (isTrialing) {
        trialEnd = isoFromUnixSeconds((subscription as any).trial_end);
        if (trialEnd) {
          const trialEndMs = Date.parse(trialEnd);
          if (Number.isFinite(trialEndMs)) {
            const nowMs = Date.now();
            trialDaysRemaining = Math.ceil((trialEndMs - nowMs) / (1000 * 60 * 60 * 24));
          }
        }

        logStep("Trial subscription found", {
          subscriptionId: subscription.id,
          trialEnd,
          trialDaysRemaining,
          subscriptionEnd,
        });
      } else {
        logStep("Active subscription found", {
          subscriptionId: subscription.id,
          subscriptionEnd,
        });
      }
    } else {
      logStep("No active subscription found");
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        subscription_end: subscriptionEnd,
        is_trialing: isTrialing,
        trial_end: trialEnd,
        trial_days_remaining: trialDaysRemaining,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
