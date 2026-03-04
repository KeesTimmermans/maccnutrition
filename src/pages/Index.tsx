import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { Dashboard } from "@/components/Dashboard";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getUserBaseline, saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateNutritionTargets, BaselineResults } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";
import macLogo from "@/assets/mac-nutrition-logo.png";
import appMockup from "@/assets/app-mockup.png";

type AppState = "welcome" | "questionnaire" | "baseline" | "dashboard";

const getCheckoutReturnUrl = () => {
  const basePath = window.location.pathname.endsWith("/") ? window.location.pathname : `${window.location.pathname}/`;
  return `${window.location.origin}${basePath}#/`;
};

const Index = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [savedBaseline, setSavedBaseline] = useState<BaselineResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutInitLoading, setCheckoutInitLoading] = useState(false);
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

          if (!checkoutUrl) {
            setCheckoutInitLoading(true);
            try {
              const { data: checkoutData, error: checkoutError } = await Promise.race([
                supabase.functions.invoke("create-checkout", { body: { return_url: getCheckoutReturnUrl() } }),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Checkout timed out")), 8000)),
              ]);
              if (!checkoutError && checkoutData?.url) {
                setCheckoutUrl(checkoutData.url);
              }
            } catch (err) {
              console.error("Checkout error:", err);
            } finally {
              setCheckoutInitLoading(false);
              setLoading(false);
            }
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
            setAppState("questionnaire");
          }
          baselineCheckedRef.current = user.id;
        } catch (error) {
          console.error("Error checking baseline:", error);
        }
      } else {
        const hasOnboarded = localStorage.getItem("cjt_onboarded");
        if (hasOnboarded) {
          const savedData = localStorage.getItem("cjt_user_data");
          if (savedData) {
            setUserData(JSON.parse(savedData));
          }
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
    checkoutUrl,
    subscriptionChecked,
    subscriptionError,
  ]);

  const handleGetStarted = () => {
    if (user) {
      setAppState("questionnaire");
    } else {
      navigate("/auth");
    }
  };

  const handleQuestionnaireComplete = async (data: OnboardingData) => {
    console.log("Onboarding data:", data);
    setUserData(data);
    const baseline = calculateNutritionTargets(data);

    if (user) {
      try {
        await saveUserBaseline(user.id, data, baseline);

        if (user.email) {
          sendBaselineEmail(
            user.email,
            user.user_metadata?.full_name || user.email.split("@")[0],
            baseline,
            data.primaryGoal,
            baseline.mealPattern,
          )
            .then((result) => {
              if (result.success) {
                console.log("Baseline email sent successfully");
              }
            })
            .catch((err) => {
              console.error("Failed to send baseline email:", err);
            });
        }

        toast({
          title: "Profile saved!",
          description: "Your personalized baseline has been created. Check your email for a summary!",
        });
      } catch (error) {
        console.error("Error saving baseline:", error);
        toast({
          title: "Error saving profile",
          description: "Your data has been saved locally.",
          variant: "destructive",
        });
      }
    }

    localStorage.setItem("cjt_user_data", JSON.stringify(data));
    setSavedBaseline(baseline);
    setAppState("baseline");
  };

  const handleBaselineContinue = () => {
    localStorage.setItem("cjt_onboarded", "true");
    setAppState("dashboard");
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
        hasCheckoutUrl: !!checkoutUrl,
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-medium text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Subscription required</h1>
          <p className="text-sm text-muted-foreground">
            Open checkout in a new tab to continue. If nothing opens, allow popups for this site.
          </p>

          {subscriptionError ? (
            <p className="text-xs text-muted-foreground">
              We're having trouble verifying your trial right now. Try refreshing access before starting checkout again.
            </p>
          ) : null}

          <div className="space-y-2">
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              disabled={checkoutInitLoading}
              onClick={async () => {
                setCheckoutInitLoading(true);
                try {
                  let url = checkoutUrl;
                  if (!url) {
                    const { data, error } = await Promise.race([
                      supabase.functions.invoke("create-checkout", { body: { return_url: getCheckoutReturnUrl() } }),
                      new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error("Checkout timed out")), 8000),
                      ),
                    ]);
                    if (error) throw error;
                    url = data?.url ?? null;
                    if (url) setCheckoutUrl(url);
                  }

                  if (!url) throw new Error("No checkout URL returned");

                  const opened = window.open(url, "_blank", "noopener,noreferrer");
                  if (!opened) window.location.assign(url);
                } catch (err) {
                  console.error("Checkout error:", err);
                  toast({
                    title: "Couldn't start checkout",
                    description: "Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setCheckoutInitLoading(false);
                }
              }}
            >
              {checkoutInitLoading ? "Preparing..." : "Open Checkout"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              disabled={subscriptionLoading}
              onClick={() => checkSubscription({ force: true })}
            >
              {subscriptionLoading ? "Refreshing…" : "Refresh access"}
            </Button>
          </div>

          {checkoutUrl ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline break-all"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(checkoutUrl);
                  toast({ title: "Checkout link copied" });
                } catch {
                  // ignore
                }
              }}
            >
              Copy checkout link
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (appState === "dashboard") {
    return <Dashboard />;
  }

  if (appState === "baseline" && userData && savedBaseline) {
    return <BaselineSummary userData={userData} baseline={savedBaseline} onContinue={handleBaselineContinue} />;
  }

  if (appState === "questionnaire") {
    return <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />;
  }

  // Welcome / Landing screen
  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-[hsl(45_30%_97%)] to-[hsl(40_20%_94%)] flex flex-col">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-4 flex-shrink-0 relative z-10">
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
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center px-6 md:px-12 lg:px-20 gap-8 md:gap-16 lg:gap-24 min-h-0">
        {/* Left — copy */}
        <div className="flex-1 max-w-lg space-y-6 md:space-y-8 text-center md:text-left pt-4 md:pt-0">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground leading-[1.1] tracking-tight">
            Stop guessing your calories.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto md:mx-0">
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
                £9.99/month · 7-Day Free Trial · Cancel Anytime
              </p>
              <div className="flex items-center gap-1.5 justify-center md:justify-start">
                <Lock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">Secure checkout powered by Stripe</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
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
        <div className="flex-1 flex items-center justify-center max-w-sm md:max-w-md relative">
          {/* Soft gradient blob behind the phone */}
          <div className="absolute inset-0 -m-12 rounded-full bg-gradient-to-br from-primary/5 via-accent/10 to-transparent blur-3xl" />
          {/* Phone frame */}
          <div
            className="relative transform rotate-[2deg]"
            style={{
              width: 'clamp(240px, 22vw, 320px)',
              filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.15)) drop-shadow(0 10px 20px rgba(0,0,0,0.08))',
            }}
          >
            <div className="rounded-[3rem] border-[4px] border-[hsl(0_0%_15%)] bg-[hsl(0_0%_15%)] overflow-hidden">
              {/* Dynamic Island */}
              <div className="relative z-10 mx-auto w-[26%] h-[16px] mt-[6px] bg-[hsl(0_0%_8%)] rounded-full" />
              {/* Screen content */}
              <div
                className="bg-background overflow-hidden mt-1 mx-[2px] mb-[2px] rounded-b-[2.7rem]"
                style={{ height: 'clamp(420px, 50vh, 620px)' }}
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
