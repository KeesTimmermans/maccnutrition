import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-TRIAL-REMINDERS] ${step}${detailsStr}`);
};

// Days before trial end to send reminders
const REMINDER_DAYS = [7, 3, 1];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get all trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "trialing",
      limit: 100,
    });

    logStep("Found trialing subscriptions", { count: subscriptions.data.length });

    const remindersToSend: Array<{
      email: string;
      daysRemaining: number;
      trialEndDate: string;
    }> = [];

    for (const subscription of subscriptions.data) {
      if (!subscription.trial_end) continue;

      const trialEndDate = new Date(subscription.trial_end * 1000);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder today
      if (REMINDER_DAYS.includes(daysRemaining)) {
        // Get customer email
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        
        if (customer && !customer.deleted && customer.email) {
          remindersToSend.push({
            email: customer.email,
            daysRemaining,
            trialEndDate: trialEndDate.toISOString(),
          });
        }
      }
    }

    logStep("Reminders to send", { count: remindersToSend.length });

    // Send reminders via the send-trial-reminder function
    const results = await Promise.allSettled(
      remindersToSend.map(async (reminder) => {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-trial-reminder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(reminder),
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send reminder to ${reminder.email}: ${error}`);
        }
        
        return { email: reminder.email, success: true };
      })
    );

    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    logStep("Reminders sent", { successful, failed });

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalTrialing: subscriptions.data.length,
        remindersSent: successful,
        remindersFailed: failed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
