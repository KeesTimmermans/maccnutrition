import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-USERS] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Forbidden: admin role required");
    logStep("Admin verified", { userId: userData.user.id });

    // Fetch all auth users
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
    if (listError) throw new Error(`Failed to list users: ${listError.message}`);
    logStep("Fetched auth users", { count: authUsers.users.length });

    // Fetch all baselines
    const { data: baselines } = await supabase
      .from("user_baselines")
      .select("user_id, name, primary_goal, created_at, target_calories, weight, unit_system");

    const baselineMap = new Map((baselines ?? []).map((b: any) => [b.user_id, b]));

    // Fetch Stripe subscription statuses
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let stripeStatusMap = new Map<string, any>();

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const fetchSubscriptionsByStatus = async (
        status: "active" | "trialing" | "incomplete" | "past_due"
      ) => {
        const results: Stripe.Subscription[] = [];
        let startingAfter: string | undefined = undefined;

        while (true) {
          const page = await stripe.subscriptions.list({
            status,
            limit: 100,
            starting_after: startingAfter,
            expand: ["data.customer", "data.discount.coupon"],
          });

          results.push(...page.data);

          if (!page.has_more || page.data.length === 0) break;
          startingAfter = page.data[page.data.length - 1].id;
        }

        return results;
      };

      // Include pending states so recent checkouts don't appear as "No Sub"
      const [activeSubs, trialingSubs, incompleteSubs, pastDueSubs] = await Promise.all([
        fetchSubscriptionsByStatus("active"),
        fetchSubscriptionsByStatus("trialing"),
        fetchSubscriptionsByStatus("incomplete"),
        fetchSubscriptionsByStatus("past_due"),
      ]);

      const allSubs = [...activeSubs, ...trialingSubs, ...incompleteSubs, ...pastDueSubs];

      for (const sub of allSubs) {
        const customer = sub.customer;
        const customerObj = typeof customer === "string" ? null : customer;
        const email = !customerObj?.deleted && customerObj?.email
          ? customerObj.email.toLowerCase()
          : null;

        if (!email) {
          logStep("Skipping subscription with missing customer email", {
            subscriptionId: sub.id,
            status: sub.status,
          });
          continue;
        }

        // Extract discount/coupon info
        let discountCode: string | null = null;
        const coupon = sub.discount?.coupon;
        if (coupon) {
          if (typeof coupon === "string") {
            discountCode = coupon;
          } else {
            discountCode = coupon.name || coupon.id;
          }
        }

        stripeStatusMap.set(email, {
          status: sub.status,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          plan: sub.items.data[0]?.price?.id ?? null,
          discount_code: discountCode,
        });
      }
      logStep("Fetched Stripe subscriptions", {
        active: activeSubs.length,
        trialing: trialingSubs.length,
        incomplete: incompleteSubs.length,
        past_due: pastDueSubs.length,
        total: allSubs.length,
      });
    }

    // Build response
    const users = authUsers.users.map((u: any) => {
      const baseline = baselineMap.get(u.id) as any;
      const stripeSub = u.email ? stripeStatusMap.get(u.email.toLowerCase()) : null;

      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        name: baseline?.name ?? null,
        primary_goal: baseline?.primary_goal ?? null,
        target_calories: baseline?.target_calories ?? null,
        weight: baseline?.weight ?? null,
        unit_system: baseline?.unit_system ?? null,
        onboarded_at: baseline?.created_at ?? null,
        subscription: stripeSub ?? { status: "none" },
      };
    });

    // Sort by created_at desc
    users.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    const status = msg.includes("Forbidden") ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
