import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/lib/i18n";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MealHistory from "./pages/MealHistory";
import QuickAddMeals from "./pages/QuickAddMeals";
import Progress from "./pages/Progress";
import WhoopDemo from "./pages/WhoopDemo";
import Privacy from "./pages/Privacy";
import Diagnostics from "./pages/Diagnostics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* HashRouter ensures reloads on /progress, /history, etc. work reliably in all hosting environments */}
        <HashRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/history" element={<MealHistory />} />
            <Route path="/quick-add" element={<QuickAddMeals />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/whoop-demo" element={<WhoopDemo />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
