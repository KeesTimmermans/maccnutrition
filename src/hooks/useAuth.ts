import { useState, useEffect, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  const inFlightRef = useRef(false);
  const lastCheckRef = useRef<{ token: string | null; at: number }>({ token: null, at: 0 });

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setSubscription({ subscribed: false, subscriptionEnd: null, isTrialing: false, trialEnd: null, trialDaysRemaining: null });
      setSubscriptionLoading(false);
      return;
    }

    const token = session.access_token;
    const now = Date.now();

    // De-dupe to avoid multiple simultaneous or back-to-back checks (common on refresh)
    if (inFlightRef.current) return;
    if (lastCheckRef.current.token === token && now - lastCheckRef.current.at < 15000) return;

    inFlightRef.current = true;
    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;

      setSubscription({
        subscribed: data?.subscribed ?? false,
        subscriptionEnd: data?.subscription_end ?? null,
        isTrialing: data?.is_trialing ?? false,
        trialEnd: data?.trial_end ?? null,
        trialDaysRemaining: data?.trial_days_remaining ?? null,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setSubscription({ subscribed: false, subscriptionEnd: null, isTrialing: false, trialEnd: null, trialDaysRemaining: null });
    } finally {
      lastCheckRef.current = { token, at: Date.now() };
      setSubscriptionLoading(false);
      inFlightRef.current = false;
    }
  }, [session]);

  useEffect(() => {
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // Check subscription on session change
  useEffect(() => {
    if (session) {
      checkSubscription();
    }
  }, [session, checkSubscription]);

  // Auto-refresh subscription every minute
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [session, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cjt_onboarded");
    localStorage.removeItem("cjt_user_data");
    setSubscription({ subscribed: false, subscriptionEnd: null, isTrialing: false, trialEnd: null, trialDaysRemaining: null });
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
    checkSubscription,
  };
};
