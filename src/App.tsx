import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/lib/i18n";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
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
        </HashRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
