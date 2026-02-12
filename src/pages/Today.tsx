import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { TodayDashboard } from "@/components/TodayDashboard";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { Button } from "@/components/ui/button";
import { Sparkles, Heart, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getUserBaseline, saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateBaseline } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";
import cjtLogo from "@/assets/cjt-logo.png";

type AppState = "welcome" | "questionnaire" | "baseline" | "dashboard";

const getCheckoutReturnUrl = () => {
  const basePath = window.location.pathname.endsWith("/") ? window.location.pathname : `${window.location.pathname}/`;
  return `${window.location.origin}${basePath}#/`;
};

const Today = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [userData, setUserData] = useState<OnboardingData | null>(null);
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

  const isBootstrapping = loading || authLoading || (user ? !subscriptionChecked && !subscriptionError : false);
  const baselineCheckedRef = useRef<string | null>(null);

  // Checkout return handling
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

  // Check for existing baseline data and subscription
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
  }, [user, authLoading, subscription, subscriptionLoading, isTrialing, checkoutUrl, subscriptionChecked, subscriptionError]);

  const handleGetStarted = () => {
    if (user) {
      setAppState("questionnaire");
    } else {
      navigate("/auth");
    }
  };

  const handleQuestionnaireComplete = async (data: OnboardingData) => {
    setUserData(data);

    if (user) {
      try {
        const baseline = calculateBaseline(data);
        await saveUserBaseline(user.id, data, baseline);

        if (user.email) {
          sendBaselineEmail(
            user.email,
            user.user_metadata?.full_name || user.email.split("@")[0],
            baseline,
            data.primaryGoal,
            baseline.mealPattern,
          ).catch((err) => {
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
    setAppState("baseline");
  };

  const handleBaselineContinue = () => {
    localStorage.setItem("cjt_onboarded", "true");
    setAppState("dashboard");
  };

  // Stuck loading fallback
  useEffect(() => {
    if (!isBootstrapping) {
      setStuckLoading(false);
      return;
    }

    const t = window.setTimeout(() => setStuckLoading(true), 15000);
    return () => window.clearTimeout(t);
  }, [isBootstrapping]);

  // Loading state
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
              <img src={cjtLogo} alt="CJT Nutrition" className="w-12 h-auto" />
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
          <img src={cjtLogo} alt="CJT Nutrition" className="w-32 h-auto opacity-50" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Subscription required
  if (user && !subscription && !isTrialing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-medium text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground">Subscription required</h1>
          <p className="text-sm text-muted-foreground">
            Open checkout in a new tab to continue. If nothing opens, allow popups for this site.
          </p>

          {subscriptionError && (
            <p className="text-xs text-muted-foreground">
              We're having trouble verifying your trial right now. Try refreshing access before starting checkout again.
            </p>
          )}

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

          {checkoutUrl && (
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
          )}
        </div>
      </div>
    );
  }

  // Dashboard state - wrap in AppLayout with bottom nav
  if (appState === "dashboard") {
    return (
      <AppLayout>
        <TodayDashboard />
      </AppLayout>
    );
  }

  // Baseline summary (after onboarding)
  if (appState === "baseline" && userData) {
    return <BaselineSummary userData={userData} onContinue={handleBaselineContinue} />;
  }

  // Onboarding questionnaire
  if (appState === "questionnaire") {
    return <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />;
  }

  // Welcome screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="relative mb-10 animate-float">
          <img src={cjtLogo} alt="CJT Nutrition" className="w-48 h-auto" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 max-w-md leading-tight animate-slide-up delay-100">
          Finally, nutrition guidance that fits your life
        </h1>
        
        <p className="text-lg text-muted-foreground mb-12 max-w-sm animate-slide-up delay-150 leading-relaxed">
          Personalized coaching meets simple tracking — so you can eat well without the guesswork.
        </p>

        <div className="w-full max-w-sm space-y-4 mb-12 animate-slide-up delay-200">
          <div className="flex items-start gap-4 text-left">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Your goals, your way</h3>
              <p className="text-sm text-muted-foreground">A plan built around your preferences, schedule, and what actually works for you.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4 text-left">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">AI that learns you</h3>
              <p className="text-sm text-muted-foreground">Coach Mac adapts to your progress, energy, and habits — not generic advice.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4 text-left">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">30 seconds to log</h3>
              <p className="text-sm text-muted-foreground">Snap a photo or describe your meal. We handle the rest.</p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleGetStarted}
          variant="hero"
          size="xl"
          className="px-12 animate-slide-up delay-300"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
};

export default Today;
