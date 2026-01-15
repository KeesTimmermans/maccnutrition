import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, Copy, ArrowLeft, RefreshCw, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HealthCheck {
  name: string;
  status: "pending" | "ok" | "error" | "warning";
  message: string;
  duration?: number;
}

// Inline auth state to avoid any hook-level issues
const Diagnostics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Local auth state - don't use the shared hook to isolate this page
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [subscription, setSubscription] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [isTrialing, setIsTrialing] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  
  // Fetch auth state directly
  useEffect(() => {
    console.log("[Diagnostics] Component mounted");
    
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[Diagnostics] getSession result:", { hasSession: !!data.session, error });
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
      
      if (data.session) {
        // Check subscription
        setSubscriptionLoading(true);
        supabase.functions.invoke("check-subscription").then(({ data: subData, error: subError }) => {
          console.log("[Diagnostics] check-subscription result:", { subData, subError });
          if (!subError && subData) {
            setSubscription(subData.subscribed ?? false);
            setIsTrialing(subData.is_trialing ?? false);
            setTrialDaysRemaining(subData.trial_days_remaining ?? null);
          }
          setSubscriptionLoading(false);
        }).catch(err => {
          console.error("[Diagnostics] check-subscription error:", err);
          setSubscriptionLoading(false);
        });
      }
    }).catch(err => {
      console.error("[Diagnostics] getSession error:", err);
      setAuthLoading(false);
    });
  }, []);
  
  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("cjt_onboarded");
    localStorage.removeItem("cjt_user_data");
    setUser(null);
    setSession(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };
  
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [running, setRunning] = useState(false);

  const getCheckoutReturnUrl = () => {
    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return `${window.location.origin}${basePath}#/`;
  };

  const runChecks = async () => {
    setRunning(true);
    const results: HealthCheck[] = [];

    // 1. Auth session check
    const authStart = Date.now();
    let currentSession: any = null;

    try {
      const { data, error } = await supabase.auth.getSession();
      currentSession = data.session;

      results.push({
        name: "Auth Session",
        status: data.session ? "ok" : "warning",
        message: data.session
          ? `Logged in as ${data.session.user.email}`
          : error
            ? `Error: ${error.message}`
            : "No active session",
        duration: Date.now() - authStart,
      });
    } catch (e: any) {
      results.push({
        name: "Auth Session",
        status: "error",
        message: e?.message || "Failed to check auth",
        duration: Date.now() - authStart,
      });
    }

    // 2. Database read check
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      results.push({
        name: "Database Read",
        status: error ? "error" : "ok",
        message: error ? `Error: ${error.message}` : "Database accessible",
        duration: Date.now() - dbStart,
      });
    } catch (e: any) {
      results.push({
        name: "Database Read",
        status: "error",
        message: e?.message || "Failed to read database",
        duration: Date.now() - dbStart,
      });
    }

    const formatFnError = async (error: any, response?: Response) => {
      if (!error) return null;
      const status = response?.status;
      let bodyText: string | null = null;

      try {
        if (response) bodyText = await response.clone().text();
      } catch {
        // ignore
      }

      if (status) {
        return bodyText
          ? `HTTP ${status} — ${bodyText}`
          : `HTTP ${status} — ${error.message}`;
      }

      return error.message;
    };

    // 3. check-subscription function
    const subStart = Date.now();
    if (!currentSession) {
      results.push({
        name: "check-subscription",
        status: "warning",
        message: "Skipped (not logged in)",
        duration: Date.now() - subStart,
      });
    } else {
      try {
        const { data, error, response } = await Promise.race([
          supabase.functions.invoke("check-subscription"),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 10s")), 10000)),
        ] as const);

        const errText = await formatFnError(error, response);

        results.push({
          name: "check-subscription",
          status: error ? "error" : "ok",
          message: errText ?? `subscribed=${data?.subscribed}, trialing=${data?.is_trialing}`,
          duration: Date.now() - subStart,
        });
      } catch (e: any) {
        results.push({
          name: "check-subscription",
          status: "error",
          message: e?.message || "Function call failed",
          duration: Date.now() - subStart,
        });
      }
    }

    // 4. create-checkout function (dry-run style, just check it responds)
    const checkoutStart = Date.now();
    if (!currentSession) {
      results.push({
        name: "create-checkout",
        status: "warning",
        message: "Skipped (not logged in)",
        duration: Date.now() - checkoutStart,
      });
    } else {
      try {
        const { data, error, response } = await Promise.race([
          supabase.functions.invoke("create-checkout", { body: { return_url: getCheckoutReturnUrl() } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 10s")), 10000)),
        ] as const);

        const errText = await formatFnError(error, response);

        results.push({
          name: "create-checkout",
          status: error ? "error" : "ok",
          message: errText ?? (data?.url ? "Checkout URL generated" : "No URL returned (may be subscribed)"),
          duration: Date.now() - checkoutStart,
        });
      } catch (e: any) {
        results.push({
          name: "create-checkout",
          status: "error",
          message: e?.message || "Function call failed",
          duration: Date.now() - checkoutStart,
        });
      }
    }

    setChecks(results);
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const diagnosticsSummary = {
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    inIframe: (() => { try { return window.self !== window.top; } catch { return true; } })(),
    auth: {
      hasUser: !!user,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      authLoading,
    },
    subscription: {
      subscribed: subscription,
      isTrialing,
      trialDaysRemaining,
      subscriptionLoading,
    },
    checks: checks.map(c => ({ name: c.name, status: c.status, message: c.message, durationMs: c.duration })),
    localStorage: {
      cjt_onboarded: localStorage.getItem("cjt_onboarded"),
      cjt_user_data: localStorage.getItem("cjt_user_data") ? "[present]" : null,
    },
  };

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnosticsSummary, null, 2));
      toast({ title: "Diagnostics copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const StatusIcon = ({ status }: { status: HealthCheck["status"] }) => {
    if (status === "pending") return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
    if (status === "ok") return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === "warning") return <XCircle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Diagnostics</h1>
            <p className="text-sm text-muted-foreground">Check app health and copy debug info</p>
          </div>
        </div>

        {/* Auth summary */}
        <div className="bg-card rounded-2xl p-4 shadow-soft space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-foreground">Auth Status</h2>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p><span className="font-medium text-foreground">User:</span> {user ? user.email : "Not logged in"}</p>
                <p><span className="font-medium text-foreground">Session:</span> {session ? "Active" : "None"}</p>
                <p><span className="font-medium text-foreground">Auth Loading:</span> {authLoading ? "Yes" : "No"}</p>
              </div>
            </div>

            {!user && (
              <Button variant="outline" onClick={() => navigate("/auth")}>Log in</Button>
            )}
          </div>

          {!user && (
            <p className="text-xs text-muted-foreground">
              Your trial is tied to your account email. Please log in with the same email you used at checkout, then re-run checks.
            </p>
          )}
        </div>

        {/* Subscription summary */}
        <div className="bg-card rounded-2xl p-4 shadow-soft space-y-2">
          <h2 className="font-semibold text-foreground">Subscription Status</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Subscribed:</span> {subscription ? "Yes" : "No"}</p>
            <p><span className="font-medium text-foreground">Trialing:</span> {isTrialing ? `Yes (${trialDaysRemaining} days left)` : "No"}</p>
            <p><span className="font-medium text-foreground">Subscription Loading:</span> {subscriptionLoading ? "Yes" : "No"}</p>
          </div>
        </div>

        {/* Health checks */}
        <div className="bg-card rounded-2xl p-4 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Backend Health Checks</h2>
            <Button variant="outline" size="sm" onClick={runChecks} disabled={running}>
              <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} />
              {running ? "Running…" : "Re-run"}
            </Button>
          </div>

          <div className="space-y-3">
            {checks.length === 0 && running && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                Running checks…
              </div>
            )}
            {checks.map((check, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <StatusIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{check.name}</p>
                  <p className="text-xs text-muted-foreground break-words">{check.message}</p>
                </div>
                {check.duration !== undefined && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{check.duration}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Copy button */}
        <Button variant="hero" className="w-full" onClick={copyDiagnostics}>
          <Copy className="w-5 h-5 mr-2" />
          Copy Diagnostics to Clipboard
        </Button>

        {/* Logout button */}
        {user && (
          <Button variant="destructive" className="w-full" onClick={handleLogout}>
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
        )}

        {/* Raw JSON preview */}
        <details className="bg-muted rounded-xl">
          <summary className="cursor-pointer p-3 text-sm font-medium text-foreground">View raw JSON</summary>
          <pre className="p-4 text-xs text-foreground overflow-auto max-h-64 whitespace-pre-wrap">
            {JSON.stringify(diagnosticsSummary, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default Diagnostics;
