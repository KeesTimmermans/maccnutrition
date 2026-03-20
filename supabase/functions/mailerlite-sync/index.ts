import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MAILERLITE_API_KEY = Deno.env.get("MAILERLITE_API_KEY");
    if (!MAILERLITE_API_KEY) {
      console.error("[mailerlite-sync] MAILERLITE_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "MailerLite API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, email, name, groupId, fields } = body;

    console.log("[mailerlite-sync] Action:", action, "Email:", email);

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mlHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MAILERLITE_API_KEY}`,
    };

    let result;

    switch (action) {
      // Upsert subscriber + optionally add to group
      case "subscribe":
      case "upsert": {
        // MailerLite API: POST https://connect.mailerlite.com/api/subscribers
        const payload: Record<string, unknown> = { email };
        if (name) payload.fields = { ...fields, name };
        else if (fields) payload.fields = fields;
        if (groupId) payload.groups = [groupId];

        console.log("[mailerlite-sync] Upserting subscriber", JSON.stringify(payload));

        const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
          method: "POST",
          headers: mlHeaders,
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error("[mailerlite-sync] MailerLite error", res.status, JSON.stringify(data));
          return new Response(
            JSON.stringify({ error: "MailerLite API error", details: data }),
            { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = { success: true, subscriber: data.data };
        break;
      }

      // Add existing subscriber to a group
      case "add_to_group": {
        if (!groupId) {
          return new Response(
            JSON.stringify({ error: "groupId is required for add_to_group" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("[mailerlite-sync] Adding to group", groupId);

        const res = await fetch(
          `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}/groups/${groupId}`,
          { method: "POST", headers: mlHeaders }
        );

        const data = await res.json();
        if (!res.ok) {
          console.error("[mailerlite-sync] MailerLite error", res.status, JSON.stringify(data));
          return new Response(
            JSON.stringify({ error: "MailerLite API error", details: data }),
            { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = { success: true, data: data.data };
        break;
      }

      // Update subscriber fields
      case "update_fields": {
        if (!fields || Object.keys(fields).length === 0) {
          return new Response(
            JSON.stringify({ error: "fields object is required for update_fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const res = await fetch(
          `https://connect.mailerlite.com/api/subscribers/${encodeURIComponent(email)}`,
          {
            method: "PUT",
            headers: mlHeaders,
            body: JSON.stringify({ fields }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          console.error("[mailerlite-sync] MailerLite error", res.status, JSON.stringify(data));
          return new Response(
            JSON.stringify({ error: "MailerLite API error", details: data }),
            { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = { success: true, subscriber: data.data };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Use subscribe, add_to_group, or update_fields.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log("[mailerlite-sync] Success:", action);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[mailerlite-sync] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
