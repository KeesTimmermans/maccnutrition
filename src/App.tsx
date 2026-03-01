import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LanguageProvider } from "@/lib/i18n";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRIVACY_POLICY_VERSION, TERMS_VERSION } from "@/lib/consentConstants";
import { ReConsentModal } from "@/components/ReConsentModal";
import { AnalyticsConsentBanner } from "@/components/AnalyticsConsentBanner";
import { initAnalytics, identifyUser, resetAnalytics } from "@/lib/analytics";
import { useAuthAnalytics } from "@/analytics/useAuthAnalytics";
import { useAuth } from "@/hooks/useAuth";

// Pages
import Today from "./pages/Today";
import Progress from "./pages/Progress";
import Meals from "./pages/Meals";
import Metrics from "./pages/Metrics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Diagnostics from "./pages/Diagnostics";
import Community from "./pages/Community";
import CommunityReports from "./pages/CommunityReports";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import MealHistory from "./pages/MealHistory";
import QuickAddMeals from "./pages/QuickAddMeals";
import Onboarding from "./pages/Onboarding";
import PostCheckout from "./pages/PostCheckout";
import Pricing from "./pages/Pricing";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

/** Public routes that never show the re-consent overlay or subscription gate */
const PUBLIC_PATHS = ["/auth", "/privacy-policy", "/privacy", "/terms", "/post-checkout", "/pricing", "/reset-password"];

// ── Onboarding context ──────────────────────────────────────────────
export interface OnboardingCtx {
  onboardingCompleted: boolean | null;
  markOnboardingCompleted: () => void;
}

export const OnboardingContext = createContext<OnboardingCtx>({
  onboardingCompleted: null,
  markOnboardingCompleted: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlag = async (uid: string) => {
      const [{ data: profile }, { data: baseline }] = await Promise.all([
        supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("user_baselines")
          .select("primary_goal, activity_level, target_calories, protein_grams, carbs_grams, fats_grams")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);

      const flagComplete = profile?.onboarding_completed ?? false;
      const baselineValid = !!(
        baseline?.primary_goal &&
        baseline?.activity_level &&
        baseline?.target_calories &&
        baseline?.protein_grams &&
        baseline?.carbs_grams &&
        baseline?.fats_grams
      );

      setOnboardingCompleted(flagComplete && baselineValid);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchFlag(session.user.id);
      } else {
        setUserId(null);
        setOnboardingCompleted(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchFlag(session.user.id);
      } else {
        setOnboardingCompleted(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const markOnboardingCompleted = useCallback(async () => {
    if (!userId) throw new Error("No user ID — cannot mark onboarding complete");

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true, onboarding_completed_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) {
      if (import.meta.env.DEV) {
        console.error("[OnboardingProvider] profiles update failed:", { code: error.code, message: error.message, hint: error.hint });
      }
      throw error;
    }

    setOnboardingCompleted(true);
  }, [userId]);

  return (
    <OnboardingContext.Provider value={{ onboardingCompleted, markOnboardingCompleted }}>
      {children}
    </OnboardingContext.Provider>
  );
};

// ── Subscription gate — redirects unsubscribed users to /pricing ──
const SUBSCRIPTION_EXEMPT_PATHS = ["/auth", "/privacy-policy", "/privacy", "/terms", "/post-checkout", "/pricing", "/diagnostics", "/onboarding", "/reset-password"];

const SubscriptionGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { session, loading, subscription, subscriptionLoading, subscriptionChecked } = useAuth();

  // Don't gate exempt paths
  if (SUBSCRIPTION_EXEMPT_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  // Still loading auth state — brief spinner with failsafe
  if (loading) {
    console.log("[SubscriptionGate] auth still loading");
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Not logged in — redirect to auth immediately
  if (!session) {
    console.log("[SubscriptionGate] no session — redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  // Subscription not yet checked — show spinner only briefly
  if (!subscriptionChecked) {
    console.log("[SubscriptionGate] waiting for subscription check");
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Subscription checked and not active — redirect to pricing
  if (!subscription) {
    console.log("[SubscriptionGate] not subscribed — redirecting to /pricing");
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};

// ── Onboarding gate — redirects incomplete users to "/onboarding" ──
const ONBOARDING_EXEMPT_PATHS = ["/auth", "/privacy-policy", "/privacy", "/terms", "/diagnostics", "/onboarding", "/post-checkout", "/pricing", "/admin", "/reset-password"];

const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { onboardingCompleted } = useOnboarding();

  if (ONBOARDING_EXEMPT_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  if (onboardingCompleted === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const ConsentGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => location.pathname.startsWith(p))) {
      setChecked(true);
      return;
    }

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setChecked(true); return; }

      const uid = session.user.id;
      setUserId(uid);

      const { data } = await supabase
        .from("user_baselines")
        .select("privacy_policy_version, terms_version, health_data_consent, analytics_consent")
        .eq("user_id", uid)
        .maybeSingle();

      const privacyOk = data?.privacy_policy_version === PRIVACY_POLICY_VERSION;
      const termsOk   = data?.terms_version === TERMS_VERSION;
      const healthOk  = !!data?.health_data_consent;
      setNeedsConsent(!privacyOk || !termsOk || !healthOk);
      setChecked(true);

      if (data?.analytics_consent) {
        initAnalytics();
        identifyUser(uid);
      }
    };

    check();
  }, [location.pathname]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setNeedsConsent(false);
        setUserId(null);
        resetAnalytics();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  if (needsConsent && userId) {
    return <ReConsentModal userId={userId} onAccepted={() => setNeedsConsent(false)} />;
  }

  return <>{children}</>;
};

const App = () => {
  useAuthAnalytics();

  return (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AnalyticsConsentBanner />
        <OnboardingProvider>
          <HashRouter>
            <ScrollToTop />
            <ConsentGate>
              <SubscriptionGate>
                <OnboardingGate>
                  <Routes>
                    {/* Primary tab routes */}
                    <Route path="/" element={<Today />} />
                    <Route path="/progress" element={<Progress />} />
                    <Route path="/meals" element={<Meals />} />
                    <Route path="/metrics" element={<Metrics />} />
                    <Route path="/profile" element={<Profile />} />
                    
                    {/* Secondary routes */}
                    <Route path="/community" element={<Community />} />
                    <Route path="/community/reports" element={<CommunityReports />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/diagnostics" element={<Diagnostics />} />
                    <Route path="/post-checkout" element={<PostCheckout />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    
                    {/* Legacy routes */}
                    <Route path="/history" element={<MealHistory />} />
                    <Route path="/quick-add" element={<QuickAddMeals />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </OnboardingGate>
              </SubscriptionGate>
            </ConsentGate>
          </HashRouter>
        </OnboardingProvider>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
  );
};

export default App;
