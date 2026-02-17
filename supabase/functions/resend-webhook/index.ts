import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Webhook } from "https://esm.sh/svix@1.15.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Helper for consistent logging
const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RESEND-WEBHOOK] ${step}${detailsStr}`);
};

// Resend webhook event types
interface ResendEmailEvent {
  type: "email.sent" | "email.delivered" | "email.delivery_delayed" | "email.complained" | "email.bounced" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    logStep("Webhook request received");

    // Get webhook secret
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR: RESEND_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Svix headers for signature verification
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      logStep("ERROR: Missing Svix signature headers");
      return new Response(JSON.stringify({ error: "Missing signature headers" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get raw body for signature verification
    const payload = await req.text();
    logStep("Payload received", { length: payload.length });

    // Verify webhook signature using Svix
    const wh = new Webhook(webhookSecret);
    let event: ResendEmailEvent;

    try {
      event = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendEmailEvent;
      logStep("Signature verified successfully", { eventType: event.type });
    } catch (verifyError) {
      logStep("ERROR: Invalid signature", { error: String(verifyError) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      logStep("ERROR: Supabase credentials not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Process the event based on type
    const recipientEmail = event.data.to[0];
    const emailId = event.data.email_id;

    logStep("Processing event", { 
      type: event.type, 
      emailId, 
      recipient: recipientEmail 
    });

    // Handle email.delivered - this indicates the email was successfully delivered
    if (event.type === "email.delivered") {
      logStep("Email delivered event", { email: recipientEmail });

      // Check if we've already processed this event (idempotency)
      const { data: existingEvent, error: checkError } = await supabase
        .from("email_confirmations")
        .select("id")
        .eq("email_id", emailId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = no rows found, which is expected for new events
        logStep("ERROR: Failed to check existing event", { error: checkError.message });
      }

      if (existingEvent) {
        logStep("Event already processed (idempotent skip)", { emailId });
        return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    // Store the confirmation record (sanitize raw_event to remove PII)
      const sanitizedEvent = {
        type: event.type,
        created_at: event.created_at,
        data: {
          email_id: event.data.email_id,
          subject: event.data.subject,
          created_at: event.data.created_at,
          // Omit 'from' and 'to' fields to minimize stored PII
        },
      };

      const { error: insertError } = await supabase
        .from("email_confirmations")
        .insert({
          email_id: emailId,
          email: recipientEmail,
          event_type: event.type,
          confirmed_at: new Date().toISOString(),
          raw_event: sanitizedEvent,
        });

      if (insertError) {
        logStep("ERROR: Failed to store confirmation", { error: insertError.message });
        // Don't fail the webhook - Resend will retry
      } else {
        logStep("Confirmation stored successfully", { emailId });
      }

      // Note: Marking email as confirmed in Supabase Auth requires the user to click
      // the confirmation link. This webhook tracks delivery, not user action.
      // If you want to auto-confirm on delivery (not recommended for security),
      // you would use: await supabase.auth.admin.updateUserById(userId, { email_confirm: true })
    }

    // Handle bounce/complaint events for cleanup
    if (event.type === "email.bounced" || event.type === "email.complained") {
      logStep("Email bounce/complaint", { type: event.type, email: recipientEmail });

      // Store the event for monitoring (sanitize raw_event to remove PII)
      const sanitizedBounceEvent = {
        type: event.type,
        created_at: event.created_at,
        data: {
          email_id: event.data.email_id,
          subject: event.data.subject,
          created_at: event.data.created_at,
        },
      };

      await supabase
        .from("email_confirmations")
        .insert({
          email_id: emailId,
          email: recipientEmail,
          event_type: event.type,
          confirmed_at: new Date().toISOString(),
          raw_event: sanitizedBounceEvent,
        });
    }

    logStep("Webhook processed successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unhandled exception", { error: errorMessage });
    
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
