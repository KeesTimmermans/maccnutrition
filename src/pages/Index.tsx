import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getUserBaseline } from "@/lib/userService";
import { TRIAL_DAYS, planPriceLabel } from "../../supabase/functions/_shared/plans";
import macLogo from "@/assets/mac-nutrition-logo.png";
import appMockup from "@/assets/app-mockup.png";

type AppState = "welcome" | "onboarding" | "dashboard";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [loading, setLoading] = useState(true);
  const [stuckLoading, setStuckLoading] = useState(false);
  const {
    user,
    loading: authLoading,
    subscription,
    subscriptionLoading,
    isTrialing,
    checkSubscription,
    subscriptionChecked,
    subscriptionError,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  console.log("[Index] Render:");

  const isBootstrapping = loading || authLoading || (user ? !subscriptionChecked && !subscriptionError : false);
  const baselineCheckedRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const params = new URLSearchParams(window.location.search);
    const checkoutFromSearch = params.get("checkout");

    if (checkoutFromSearch) {
      sessionStorage.setItem("checkout_return", checkoutFromSearch);
      window.location.replace(`${window.location.origin}${window.location.pathname}#/`);
      return;
    }

    const checkout = sessionStorage.getItem("checkout_return");
    if (!checkout) return;

    sessionStorage.removeItem("checkout_return");

    if (checkout === "success") {
      if (!user) {
        toast({
          title: "Checkout complete",
          description: "Please log in to finish activating your trial.",
        });
        navigate("/auth");
        return;
      }

      checkSubscription({ force: true });
      toast({ title: "Trial activated!", description: "Loading your account…" });
    } else if (checkout === "cancel") {
      toast({ title: "Checkout canceled", description: "You can resume checkout anytime." });
    }
  }, [authLoading, user, navigate, checkSubscription, toast]);

  useEffect(() => {
    const checkUserBaseline = async () => {
      if (authLoading) return;
      if (user && !subscriptionChecked && !subscriptionError) return;

      if (user) {
        if (!subscription && !isTrialing) {
          if (!subscriptionChecked || subscriptionError) {
            setLoading(false);
            return;
          }

          setLoading(false);
          return;
        }

        if (baselineCheckedRef.current === user.id) {
          setLoading(false);
          return;
        }

        try {
          const baseline = await getUserBaseline(user.id);
          if (baseline) {
            setAppState("dashboard");
          } else {
            setAppState("onboarding");
          }
          baselineCheckedRef.current = user.id;
        } catch (error) {
          console.error("Error checking baseline:", error);
        }
      } else {
        if (localStorage.getItem("cjt_onboarded")) {
          setAppState("dashboard");
        }
      }
      setLoading(false);
    };

    checkUserBaseline();
  }, [
    user,
    authLoading,
    subscription,
    subscriptionLoading,
    isTrialing,
    subscriptionChecked,
    subscriptionError,
  ]);

  const handleGetStarted = () => {
    navigate(user ? "/onboarding" : "/auth?mode=signup");
  };

  useEffect(() => {
    if (!isBootstrapping) {
      setStuckLoading(false);
      return;
    }

    const t = window.setTimeout(() => setStuckLoading(true), 15000);
    return () => window.clearTimeout(t);
  }, [isBootstrapping]);

  if (isBootstrapping) {
    if (stuckLoading) {
      const diagnostics = {
        at: new Date().toISOString(),
        hasUser: !!user,
        authLoading,
        subscriptionLoading,
        subscribed: subscription,
        isTrialing,
      };

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-medium space-y-4">
            <div className="flex items-center gap-3">
              <img src={macLogo} alt="MAC Nutrition" className="w-12 h-auto" style={{ mixBlendMode: 'multiply' }} />
              <div>
                <h1 className="text-lg font-bold text-foreground">Still loading…</h1>
                <p className="text-sm text-muted-foreground">
                  This is taking longer than expected. Use the buttons below to continue.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="hero" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.removeItem("cjt_onboarded");
                    localStorage.removeItem("cjt_user_data");
                    toast({ title: "Cleared local data", description: "Reloading…" });
                    window.location.reload();
                  } catch {
                    window.location.reload();
                  }
                }}
              >
                Clear local data
              </Button>
              <Button variant="outline" onClick={() => navigate("/diagnostics")}>
                Open Diagnostics
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
                    toast({ title: "Diagnostics copied" });
                  } catch {
                    // ignore
                  }
                }}
              >
                Copy diagnostics
              </Button>
            </div>

            <pre className="max-h-48 overflow-auto rounded-xl bg-muted p-3 text-xs text-foreground whitespace-pre-wrap">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <img src={macLogo} alt="MAC Nutrition" className="w-32 h-auto opacity-50" style={{ mixBlendMode: 'multiply' }} />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && !subscription && !isTrialing) {
    return <Navigate to="/pricing" replace />;
  }

  if (appState === "dashboard") {
    return <Dashboard />;
  }

  if (appState === "onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Welcome / Landing screen
  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-gradient-to-br from-[hsl(45_30%_97%)] to-[hsl(40_20%_94%)] flex flex-col">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-5 md:px-12 lg:px-20 py-3 md:py-4 flex-shrink-0 relative z-10">
        <img
          src={macLogo}
          alt="MacNutrition"
          className="h-8 md:h-10 w-auto"
          style={{ mixBlendMode: "multiply" }}
        />
        <Button
          variant="ghost"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/auth")}
        >
          Log in
        </Button>
      </nav>

      {/* Main content — two columns */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center px-5 md:px-12 lg:px-20 gap-6 md:gap-16 lg:gap-24 min-h-0 pb-8 md:pb-0">
        {/* Left — copy */}
        <div className="flex-1 max-w-lg space-y-5 md:space-y-8 text-center md:text-left pt-4 md:pt-0">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-foreground leading-[1.1] tracking-tight">
            Stop guessing your calories.
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto md:mx-0">
            Personalised nutrition plan and coaching built around your body, training, and lifestyle — no food restrictions.
          </p>

          <div className="space-y-3">
            <Button
              variant="hero"
              size="xl"
              className="w-full md:w-auto text-base px-10 rounded-2xl shadow-medium hover:shadow-glow transition-all duration-300 hover:scale-[1.03]"
              onClick={handleGetStarted}
            >
              Build My Plan
            </Button>

            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {planPriceLabel("monthly")} or {planPriceLabel("yearly")} · {TRIAL_DAYS}-day free trial · Cancel anytime
              </p>
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Secure checkout powered by Stripe</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1 md:pt-2">
            {[
              "Personalised targets tailored to you",
              "Flexible, not restrictive",
              "Adjusts to your lifestyle",
              "Instant feedback from Coach Mac",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2.5 justify-center md:justify-start">
                <Check className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground/80">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — iPhone mockup with screenshot */}
        <div className="flex-1 flex items-center justify-center max-w-[240px] md:max-w-md relative">
          {/* Soft gradient blob behind the phone */}
          <div className="absolute inset-0 -m-12 rounded-full bg-gradient-to-br from-primary/5 via-accent/10 to-transparent blur-3xl" />
          {/* Phone frame */}
          <div
            className="relative transform rotate-[2deg]"
            style={{
              width: 'clamp(200px, 22vw, 320px)',
              filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.15)) drop-shadow(0 10px 20px rgba(0,0,0,0.08))',
            }}
          >
            <div className="rounded-[2.5rem] md:rounded-[3rem] border-[3px] md:border-[4px] border-[hsl(0_0%_15%)] bg-[hsl(0_0%_15%)] overflow-hidden">
              {/* Dynamic Island */}
              <div className="relative z-10 mx-auto w-[26%] h-[12px] md:h-[16px] mt-[4px] md:mt-[6px] bg-[hsl(0_0%_8%)] rounded-full" />
              {/* Screen content */}
              <div
                className="bg-background overflow-hidden mt-1 mx-[2px] mb-[2px] rounded-b-[2.2rem] md:rounded-b-[2.7rem]"
                style={{ height: 'clamp(320px, 50vh, 620px)' }}
              >
                <img
                  src={appMockup}
                  alt="MacNutrition app dashboard showing coaching plan, calorie targets, and macro breakdown"
                  className="w-full h-full object-contain object-top block"
                />
              </div>
            </div>
            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[28%] h-[3px] bg-foreground/30 rounded-full" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
