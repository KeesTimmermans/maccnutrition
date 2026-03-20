/**
 * MailerLite sync helper — calls the mailerlite-sync edge function.
 * All calls are fire-and-forget so they never block the user flow.
 *
 * ── Group IDs ──
 * Replace the placeholder values below with your real MailerLite group IDs.
 * You can find them in MailerLite → Subscribers → Groups → click a group → the ID is in the URL.
 */

import { supabase } from "@/integrations/supabase/client";

// ⚠️ CONFIGURE THESE with your real MailerLite group IDs
export const ML_GROUPS = {
  ONBOARDING_WELCOME: "REPLACE_WITH_ONBOARDING_GROUP_ID",
  PAID_USERS: "REPLACE_WITH_PAID_USERS_GROUP_ID",
  COMPETITION_PREP: "REPLACE_WITH_COMP_PREP_GROUP_ID",
} as const;

interface SyncPayload {
  action: "subscribe" | "upsert" | "add_to_group" | "update_fields";
  email: string;
  name?: string;
  groupId?: string;
  fields?: Record<string, string | number | boolean>;
}

/**
 * Fire-and-forget call to the mailerlite-sync edge function.
 * Logs success/failure but never throws — callers don't need to await.
 */
async function syncToMailerLite(payload: SyncPayload): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("mailerlite-sync", {
      body: payload,
    });

    if (error) {
      console.error("[MailerLite Sync] Edge function error:", error.message);
      return;
    }

    console.log("[MailerLite Sync] Success:", payload.action, data);
  } catch (err) {
    console.error("[MailerLite Sync] Unexpected error:", err);
  }
}

// ─── Trigger helpers ───────────────────────────────────────────

/** Called after onboarding is completed */
export function syncOnboardingCompleted(email: string, name?: string): void {
  syncToMailerLite({
    action: "subscribe",
    email,
    name,
    groupId: ML_GROUPS.ONBOARDING_WELCOME,
    fields: {
      onboarding_completed: "true",
      onboarding_completed_at: new Date().toISOString(),
    },
  });
}

/** Called after successful subscription checkout */
export function syncSubscriptionActive(email: string, name?: string): void {
  syncToMailerLite({
    action: "subscribe",
    email,
    name,
    groupId: ML_GROUPS.PAID_USERS,
    fields: {
      subscription_active: "true",
      subscribed_at: new Date().toISOString(),
    },
  });
}

/** Called after a competition prep is created/activated */
export function syncCompetitionPrepActivated(
  email: string,
  compData?: {
    eventType?: string;
    eventDate?: string;
    division?: string;
    primaryGoal?: string;
  },
): void {
  syncToMailerLite({
    action: "subscribe",
    email,
    groupId: ML_GROUPS.COMPETITION_PREP,
    fields: {
      comp_prep_active: "true",
      comp_event_type: compData?.eventType || "",
      comp_event_date: compData?.eventDate || "",
      comp_division: compData?.division || "",
      comp_goal: compData?.primaryGoal || "",
    },
  });
}
