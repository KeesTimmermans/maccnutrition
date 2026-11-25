import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dashboard } from "@/components/Dashboard";
import { Lock, ScanLine, Gauge, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getUserBaseline } from "@/lib/userService";
import macLogo from "@/assets/mac-nutrition-logo.png";

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

  // Welcome / Landing screen (signed out)
  const startTrial = (position: "hero" | "final") => {
    track("landing_cta_clicked", { position });
    handleGetStarted();
  };

  const ctaButton = (position: "hero" | "final") => (
    <div className="space-y-2">
      <Button variant="hero" size="xl" className="w-full sm:w-auto text-base px-8 rounded-2xl shadow-medium" onClick={() => startTrial(position)}>
        Start your 14-day free trial
      </Button>
      <p className="text-xs text-muted-foreground">Card needed to start. You won't be charged until day 14. Cancel anytime.</p>
      <div className="flex items-center gap-1.5 justify-center md:justify-start">
        <Lock className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Secure checkout powered by Stripe</span>
      </div>
    </div>
  );

  const steps = [
    "Start your free trial (2 minutes)",
    "Tell us about you (1 minute)",
    "Get your Nutrition Score, follow a simple daily checklist and rescore every month",
  ];
  const features = [
    { icon: ScanLine, title: "Scan & rate", text: "Scan any barcode and see how it scores, with better options to swap to." },
    { icon: Gauge, title: "Your monthly Nutrition Score", text: "A number to chase, repeated every month so you can see yourself improve." },
    { icon: MessageCircle, title: "Coach Mac", text: "Plain-English answers to your food questions, with no restrictions." },
  ];
  const faqs = [
    { q: "Do I need a card to start?", a: "Yes, but you're not charged until the trial ends after 14 days, and we email you before it does." },
    { q: "What happens after the trial?", a: "You're charged automatically unless you cancel. You can cancel anytime from Settings." },
    { q: "Do I have to count calories?", a: "No. You choose: follow simple habits, or track calories if you like numbers." },
    { q: "What is Scan & rate?", a: "Scan a food's barcode and get a simple score out of 10, the reasons behind it, and better options from the same aisle." },
    { q: "How does the Nutrition Score work?", a: "Answer 16 quick questions about how you eat, sleep and feel. You get a score out of 100, your focus area and a tip. Retake it every month." },
    { q: "Is it for me if I only train a few times a week?", a: "Yes. MacNutrition is built for busy parents who train two or three times a week." },
  ];
  const areas = [
    { label: "Whole foods", value: 82 },
    { label: "Hydration", value: 68 },
    { label: "Sleep", value: 55 },
  ];
  const ring = 2 * Math.PI * 42;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <nav className="flex items-center justify-between px-5 md:px-12 lg:px-20 py-3 md:py-4">
        <img src={macLogo} alt="MacNutrition" className="h-8 md:h-10 w-auto" style={{ mixBlendMode: "multiply" }} />
        <Button variant="ghost" className="text-sm font-medium" onClick={() => navigate("/auth")}>Log in</Button>
      </nav>

      <main className="flex-1">
        <section className="flex flex-col md:flex-row items-center gap-10 md:gap-16 px-5 md:px-12 lg:px-20 py-8 md:py-16 max-w-6xl mx-auto">
          <div className="flex-1 max-w-lg space-y-5 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground leading-[1.1] tracking-tight">Eating well, made simple.</h1>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
              Everyday nutrition for busy parents who train 2-3 times a week. Scan your food, know your score, build better habits.
            </p>
            {ctaButton("hero")}
          </div>

          <div className="flex-1 flex justify-center" aria-hidden="true">
            <div className="w-[240px] sm:w-[260px] rounded-[2.5rem] border-[6px] border-foreground/85 bg-card shadow-medium overflow-hidden">
              <div className="mx-auto mt-2 w-20 h-4 rounded-full bg-foreground/85" />
              <div className="px-5 pt-5 pb-8 space-y-5">
                <p className="text-xs font-semibold text-muted-foreground text-center">Your Nutrition Score</p>
                <div className="relative mx-auto w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-muted" />
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-primary"
                      strokeDasharray={ring} strokeDashoffset={ring * (1 - 0.72)} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-foreground">72</span>
                    <span className="text-xs font-semibold text-primary">Strong</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {areas.map((a) => (
                    <div key={a.label} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{a.label}</span><span>{a.value}</span></div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${a.value}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-muted/60 p-3 text-[11px] text-foreground/80">Focus this month: sleep. Aim for a regular bedtime.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 md:px-12 lg:px-20 py-10 bg-muted/40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-6">How it works</h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s} className="rounded-2xl bg-card p-5 flex gap-3 items-start">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm text-foreground">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-5 md:px-12 lg:px-20 py-10">
          <div className="max-w-4xl mx-auto grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-5 space-y-2">
                <f.icon className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 md:px-12 lg:px-20 py-10 bg-muted/40">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-4">Questions</h2>
            <Accordion type="single" collapsible className="rounded-2xl bg-card px-5">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`} className={i === faqs.length - 1 ? "border-b-0" : undefined}>
                  <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-5 py-12 text-center flex flex-col items-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to eat well without the fuss?</h2>
          <div className="[&_div]:justify-center">{ctaButton("final")}</div>
        </section>
      </main>

      <footer className="px-5 py-6 border-t text-center text-xs text-muted-foreground flex justify-center gap-6" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
        <button onClick={() => navigate("/terms")} className="hover:text-foreground">Terms</button>
        <button onClick={() => navigate("/privacy-policy")} className="hover:text-foreground">Privacy</button>
      </footer>
    </div>
  );
};

export default Index;
