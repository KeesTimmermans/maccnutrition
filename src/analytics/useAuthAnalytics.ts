import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { identifyUser, resetUser } from "@/analytics/posthog";

/**
 * Subscribes to auth state changes and links/unlinks
 * the PostHog session to the authenticated user.
 * Call once near the app root.
 */
export function useAuthAnalytics(): void {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        identifyUser(session.user.id);
      } else {
        resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}
