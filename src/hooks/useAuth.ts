import { useState, useEffect, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { trackSubscribed } from "@/lib/analytics";

interface SubscriptionStatus {
  subscribed: boolean;
  subscriptionEnd: string | null;
  isTrialing: boolean;
  trialEnd: string | null;
  trialDaysRemaining: number | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    subscribed: false,
    subscriptionEnd: null,
    isTrialing: false,
    trialEnd: null,
    trialDaysRemaining: null,
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);

  const inFlightRef = useRef(false);
  const lastCheckRef = useRef<{ token: string | null; at: number }>({ token: null, at: 0 });

  const checkSubscription = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!session) {
        console.log("[useAuth] No session — skipping check-subscription");
        setSubscription({
          subscribed: false,
          subscriptionEnd: null,
          isTrialing: false,
          trialEnd: null,
          trialDaysRemaining: null,
        });
        setSubscriptionError(null);
        setSubscriptionChecked(true);
        setSubscriptionLoading(false);
        return;
      }

      const force = opts?.force ?? false;
      const token = session.access_token;
      const now = Date.now();

      // De-dupe to avoid multiple simultaneous or back-to-back checks
      if (inFlightRef.current) return;
      if (!force && lastCheckRef.current.token === token && now - lastCheckRef.current.at < 30000) return;

      inFlightRef.current = true;
      const isInitialCheck = !subscriptionChecked;
      if (force || isInitialCheck) {
        setSubscriptionLoading(true);
      }

      console.log("[useAuth] got session, calling check-subscription");

      // Force a session refresh before calling the edge function to avoid stale tokens
      const { data: refreshedSession } = await supabase.auth.getSession();
      if (!refreshedSession.session) {
        console.warn("[useAuth] Session lost during refresh — marking as unsubscribed");
        setSubscription({ subscribed: false, subscriptionEnd: null, isTrialing: false, trialEnd: null, trialDaysRemaining: null });
        setSubscriptionError(null);
        setSubscriptionChecked(true);
        setSubscriptionLoading(false);
        inFlightRef.current = false;
        return;
      }

      try {
        const { data, error } = await Promise.race([
          supabase.functions.invoke("check-subscription"),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Subscription check timed out (10s)")), 10000)),
        ]);

        if (error) {
          console.error("[useAuth] check-subscription error:", error);
          throw error;
        }

        console.log("[useAuth] check-subscription response:", data);

        const wasSubscribed = subscription.subscribed;
        const nowSubscribed = data?.subscribed ?? false;
        setSubscription({
          subscribed: nowSubscribed,
          subscriptionEnd: data?.subscription_end ?? null,
          isTrialing: data?.is_trialing ?? false,
          trialEnd: data?.trial_end ?? null,
          trialDaysRemaining: data?.trial_days_remaining ?? null,
        });
        if (!wasSubscribed && nowSubscribed) {
          trackSubscribed();
        }
        setSubscriptionError(null);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[useAuth] check-subscription failed:", msg);
        setSubscriptionError(msg);
        // Treat errors as unsubscribed so the gate doesn't hang
        setSubscription({
          subscribed: false,
          subscriptionEnd: null,
          isTrialing: false,
          trialEnd: null,
          trialDaysRemaining: null,
        });
      } finally {
        // ALWAYS mark as checked & stop loading to prevent infinite spinner
        setSubscriptionChecked(true);
        lastCheckRef.current = { token, at: Date.now() };
        setSubscriptionLoading(false);
        inFlightRef.current = false;
      }
    },
    [session],
  );

  useEffect(() => {
    let resolved = false;

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      resolved = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Also try getSession() directly
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!resolved) {
          resolved = true;
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("getSession error:", err);
        if (!resolved) {
          resolved = true;
          setLoading(false);
        }
      });

    // Failsafe: if auth doesn't resolve in 8 seconds, stop loading anyway
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn("Auth check timed out, continuing without session");
        resolved = true;
        setLoading(false);
      }
    }, 8000);

    return () => {
      authSubscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Check subscription on session change
  useEffect(() => {
    if (session) {
      checkSubscription();
    }
  }, [session, checkSubscription]);

  // Auto-refresh subscription every 2 minutes (reduced frequency)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 120000);

    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cjt_onboarded");
    localStorage.removeItem("cjt_user_data");
    setSubscription({
      subscribed: false,
      subscriptionEnd: null,
      isTrialing: false,
      trialEnd: null,
      trialDaysRemaining: null,
    });
  };

  return {
    user,
    session,
    loading,
    signOut,
    subscription: subscription.subscribed,
    subscriptionEnd: subscription.subscriptionEnd,
    isTrialing: subscription.isTrialing,
    trialEnd: subscription.trialEnd,
    trialDaysRemaining: subscription.trialDaysRemaining,
    subscriptionLoading,
    subscriptionChecked,
    subscriptionError,
    checkSubscription,
  };
};
