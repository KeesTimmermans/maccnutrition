import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WearableConnection } from "@/components/WearableConnection";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { Dashboard } from "@/components/Dashboard";
import { Sparkles, Heart, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getUserBaseline, saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateBaseline } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";
import cjtLogo from "@/assets/cjt-logo.png";

type AppState = "welcome" | "connection" | "questionnaire" | "baseline" | "dashboard";

const getCheckoutReturnUrl = () => {
  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : `${window.location.pathname}/`;
  // HashRouter expects /#/… routes
  return `${window.location.origin}${basePath}#/`;
};

const Index = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutInitLoading, setCheckoutInitLoading] = useState(false);
  const [stuckLoading, setStuckLoading] = useState(false);
  const { user, loading: authLoading, subscription, subscriptionLoading, isTrialing, checkSubscription, subscriptionChecked, subscriptionError } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // IMPORTANT: don't block the whole app UI during background subscription refreshes.
  // Only block during the initial auth+subscription bootstrap.
  const isBootstrapping =
    loading || authLoading || (user ? (!subscriptionChecked && !subscriptionError) : false);

  // Prevent re-fetching baseline repeatedly (e.g. when subscription refresh runs)
  const baselineCheckedRef = useRef<string | null>(null);

  // Checkout return handling:
  // Stripe returns to a URL WITHOUT hash fragments (e.g. /?checkout=success).
  // Since the app uses HashRouter, we must move the user back onto /#/ and then refresh subscription.
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
      // Wait for the *initial* subscription verification (or an error) before deciding what to show.
      // This avoids "Loading…" screens that unmount the questionnaire and reset progress.
      if (user && !subscriptionChecked && !subscriptionError) return;

      if (user) {
        // If the backend can't verify subscription right now, don't force checkout.
        // This prevents users from getting stuck in a "start trial" loop.
        if (!subscription && !isTrialing) {
          // If we haven't successfully verified at least once (or we hit an error),
          // show the subscription screen and let the user manually start checkout/refresh.
          if (!subscriptionChecked || subscriptionError) {
            setLoading(false);
            return;
          }

          // Pre-fetch a checkout URL so the "Open Checkout" button is instant,
          // but don't auto-redirect (avoids loops on refresh / popup blockers).
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

        // Baseline already resolved for this user in this session; don't block UI again
        if (baselineCheckedRef.current === user.id) {
          setLoading(false);
          return;
        }

        try {
          const baseline = await getUserBaseline(user.id);
          if (baseline) {
            // User has completed onboarding
            setAppState("dashboard");
          } else {
            // User is authenticated but hasn't completed onboarding
            setAppState("connection");
          }
          baselineCheckedRef.current = user.id;
        } catch (error) {
          console.error("Error checking baseline:", error);
        }
      } else {
        // Check localStorage for non-authenticated flow
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
      setAppState("connection");
    } else {
      navigate("/auth");
    }
  };

  const handleConnectionChoice = (type: "wearable" | "questionnaire") => {
    if (type === "questionnaire") {
      setAppState("questionnaire");
    } else {
      setAppState("dashboard");
    }
  };

  const handleQuestionnaireComplete = async (data: OnboardingData) => {
    console.log("Onboarding data:", data);
    setUserData(data);
    
    if (user) {
      try {
        const baseline = calculateBaseline(data);
        await saveUserBaseline(user.id, data, baseline);
        
        // Send baseline summary email
        if (user.email) {
          sendBaselineEmail(
            user.email,
            user.user_metadata?.full_name || user.email.split('@')[0],
            baseline,
            data.primaryGoal,
            baseline.mealPattern
          ).then(result => {
            if (result.success) {
              console.log("Baseline email sent successfully");
            }
          }).catch(err => {
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
    
    // Save to localStorage as backup
    localStorage.setItem("cjt_user_data", JSON.stringify(data));
    setAppState("baseline");
  };

  const handleBaselineContinue = () => {
    localStorage.setItem("cjt_onboarded", "true");
    setAppState("dashboard");
  };

  // If anything in the auth/subscription bootstrap hangs, never leave the user on a blank screen.
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
          <img src={cjtLogo} alt="CJT Nutrition" className="w-32 h-auto opacity-50" />
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
              We’re having trouble verifying your trial right now. Try refreshing access before starting checkout again.
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
                      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Checkout timed out")), 8000)),
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

  if (appState === "baseline" && userData) {
    return <BaselineSummary userData={userData} onContinue={handleBaselineContinue} />;
  }

  if (appState === "connection") {
    return <WearableConnection onConnect={handleConnectionChoice} />;
  }

  if (appState === "questionnaire") {
    return <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />;
  }

  // Welcome screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Logo */}
        <div className="relative mb-6 animate-float">
          <img 
            src={cjtLogo} 
            alt="CJT Nutrition Logo" 
            className="w-64 h-auto"
          />
        </div>

        {/* Tagline */}
        <h2 className="text-2xl font-bold text-foreground mb-2 animate-slide-up delay-100">
          Nutrition with intention
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-sm animate-slide-up delay-150">
          Like having a nutrition coach in your pocket
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10 w-full max-w-sm animate-slide-up delay-200">
          {[
            { icon: <Heart className="w-6 h-6" />, label: "Personalized" },
            { icon: <Zap className="w-6 h-6" />, label: "Quick Logging" },
            { icon: <Sparkles className="w-6 h-6" />, label: "Smart Insights" },
          ].map((feature, index) => (
            <div
              key={feature.label}
              className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl shadow-soft"
            >
              <div className="text-primary">{feature.icon}</div>
              <span className="text-xs font-semibold text-foreground">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="bg-card rounded-2xl p-4 shadow-soft max-w-sm mb-8 animate-slide-up delay-300">
          <p className="text-sm text-foreground italic mb-2">
            "The nutrition app that fulfills all your needs — your one-stop shop to take care of your nutrition!"
          </p>
          <p className="text-xs text-muted-foreground">
            — CJT Nutrition user
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="p-6 space-y-4 animate-slide-up delay-400">
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          onClick={handleGetStarted}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          {user ? "Continue Setup" : "Get Started Free"}
        </Button>
        {!user && (
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button 
              onClick={() => navigate("/auth")}
              className="text-primary font-semibold hover:underline"
            >
              Log In
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default Index;
