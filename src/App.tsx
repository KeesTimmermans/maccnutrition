import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PRIVACY_POLICY_VERSION } from "@/lib/consentConstants";
import { ReConsentModal } from "@/components/ReConsentModal";
// New page structure
import Today from "./pages/Today";
import Progress from "./pages/Progress";
import Meals from "./pages/Meals";
import Metrics from "./pages/Metrics";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
// Supporting pages
import Auth from "./pages/Auth";
import Privacy from "./pages/Privacy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Diagnostics from "./pages/Diagnostics";

import NotFound from "./pages/NotFound";
// Legacy pages (kept temporarily for backwards compatibility)
import MealHistory from "./pages/MealHistory";
import QuickAddMeals from "./pages/QuickAddMeals";

const queryClient = new QueryClient();

/** Public routes that never show the re-consent overlay */
const PUBLIC_PATHS = ["/auth", "/privacy-policy", "/privacy", "/terms"];

const ConsentGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Don't gate public paths
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
        .select("privacy_policy_version")
        .eq("user_id", uid)
        .maybeSingle();

      const storedVersion = data?.privacy_policy_version ?? null;
      setNeedsConsent(!storedVersion || storedVersion !== PRIVACY_POLICY_VERSION);
      setChecked(true);
    };

    check();
  }, [location.pathname]);

  // Also re-check when auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setNeedsConsent(false); setUserId(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!checked) return null;

  if (needsConsent && userId) {
    return <ReConsentModal userId={userId} onAccepted={() => setNeedsConsent(false)} />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <ConsentGate>
            <Routes>
              {/* Primary tab routes */}
              <Route path="/" element={<Today />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/meals" element={<Meals />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/profile" element={<Profile />} />
              
              {/* Secondary routes */}
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/diagnostics" element={<Diagnostics />} />
              
              
              {/* Legacy routes (to be removed in future commits) */}
              <Route path="/history" element={<MealHistory />} />
              <Route path="/quick-add" element={<QuickAddMeals />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ConsentGate>
        </HashRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
