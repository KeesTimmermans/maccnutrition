import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import macLogo from "@/assets/mac-nutrition-logo.png";

const features = [
  "AI Nutrition Coach with personalized advice",
  "Custom meal plans tailored to your goals",
  "Detailed progress tracking & analytics",
  "Unlimited meal logging & history",
  "Priority support",
];

const Pricing = () => {
  const [loading, setLoading] = useState(false);

  const getCheckoutReturnUrl = () => {
    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return `${window.location.origin}${basePath}`;
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.hash = "#/auth";
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { return_url: getCheckoutReturnUrl() },
      });
      if (error) throw error;

      if (data?.already_subscribed) {
        window.location.hash = "#/";
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <img src={macLogo} alt="MAC Nutrition" className="h-14 mx-auto" style={{ mixBlendMode: "multiply" }} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscribe to Continue</h1>
          <p className="text-muted-foreground text-sm mt-1">
            A subscription is required to use MacNutrition.
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-soft border border-border space-y-5">
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg text-foreground">MacNutrition Premium</span>
          </div>

          <div>
            <span className="text-3xl font-bold text-foreground">£9.99</span>
            <span className="text-muted-foreground">/month</span>
            <p className="text-xs text-muted-foreground mt-1">7-day free trial included</p>
          </div>

          <ul className="space-y-2 text-left">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Button onClick={handleSubscribe} className="w-full" size="lg" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
            Start Free Trial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
