import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate email HTML
function generateConfirmationEmail(
  confirmLink: string,
  firstName?: string
): string {
  const greeting = firstName ? `Hi ${firstName}!` : "Welcome!";
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm your MACCnutrition account</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f6f9fc;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 40px 40px 20px;">
                    <h1 style="margin: 0 0 20px; font-size: 28px; font-weight: bold; color: #1a1a1a; text-align: center;">
                      ${greeting}
                    </h1>
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 26px; color: #444444; text-align: center;">
                      Thanks for signing up for MACCnutrition! Please confirm your email address to get started with your personalized nutrition journey.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="text-align: center;">
                          <a href="${confirmLink}" style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px;">
                            Confirm Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px;">
                    <p style="margin: 0; font-size: 14px; line-height: 22px; color: #666666; text-align: center;">
                      If you didn't create an account with MACCnutrition, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px 40px; border-top: 1px solid #eaeaea;">
                    <p style="margin: 0; font-size: 12px; line-height: 22px; color: #898989; text-align: center;">
                      © MACCnutrition - Your personalized nutrition companion
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    console.log("[SEND-AUTH-EMAIL] Received webhook request");

    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        user_metadata?: {
          first_name?: string;
        };
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
      };
    };

    console.log("[SEND-AUTH-EMAIL] Processing email for:", user.email);
    console.log("[SEND-AUTH-EMAIL] Email action type:", email_action_type);

    const firstName = user.user_metadata?.first_name;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const confirmLink = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to || "https://maccnutrition.lovable.app"}`;

    const html = generateConfirmationEmail(confirmLink, firstName);

    // Determine email subject based on action type
    let subject = "Confirm your MACCnutrition account";
    if (email_action_type === "recovery") {
      subject = "Reset your MACCnutrition password";
    } else if (email_action_type === "email_change") {
      subject = "Confirm your new email address";
    }

    const { data, error } = await resend.emails.send({
      from: "MACCnutrition <noreply@cjtprogramming.com>",
      to: [user.email],
      subject,
      html,
    });

    if (error) {
      console.error("[SEND-AUTH-EMAIL] Resend error:", error);
      throw error;
    }

    console.log("[SEND-AUTH-EMAIL] Email sent successfully:", data);

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SEND-AUTH-EMAIL] Error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: errorMessage,
        },
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
