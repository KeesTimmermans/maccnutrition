import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const normalizeReturnUrl = (raw: string | null) => {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

// Stripe redirect URLs cannot preserve hash fragments reliably.
// Instead, append query params to the root URL (before any hash), then let the frontend detect them.
const withCheckoutParam = (baseUrl: string, status: "success" | "cancel") => {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("checkout", status);
    // Remove hash for the redirect - the frontend will handle routing
    url.hash = "";
    return url.toString();
  } catch {
    // Fallback: simple string append
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl.split("#")[0]}${sep}checkout=${status}`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabaseClient.auth.getUser(token);
    if (error) throw new Error(`Authentication error: ${error.message}`);

    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // Prevent creating multiple overlapping subscriptions/trials for the same customer.
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const hasAccess = existingSubs.data.some(
        (s: any) => s?.status === "active" || s?.status === "trialing"
      );

      if (hasAccess) {
        logStep("Customer already subscribed/trialing", {
          customerId,
          statuses: existingSubs.data.map((s: any) => s.status),
        });
        return new Response(JSON.stringify({ url: null, already_subscribed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const requestedReturnUrl = body?.return_url ?? body?.returnUrl ?? null;
    const origin = req.headers.get("origin") ?? "";

    // Prefer an explicit return_url from the client (more reliable than Origin in embedded browsers)
    const baseReturnUrl =
      normalizeReturnUrl(requestedReturnUrl) ?? (origin ? `${origin}/#/` : "");

    if (!baseReturnUrl) {
      throw new Error("Missing return URL (return_url)");
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: "price_1SgrQ5EhSXv7TD1NMX0Yqbt8",
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 14,
      },
      allow_promotion_codes: true,
      success_url: withCheckoutParam(baseReturnUrl, "success"),
      cancel_url: withCheckoutParam(baseReturnUrl, "cancel"),
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
