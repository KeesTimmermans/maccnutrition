import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, XCircle, Loader2, Copy, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HealthCheck {
  name: string;
  status: "pending" | "ok" | "error" | "warning";
  message: string;
  duration?: number;
}

const Diagnostics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, session, loading: authLoading, subscription, subscriptionLoading, isTrialing, trialDaysRemaining } = useAuth();
  
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const results: HealthCheck[] = [];

    // 1. Auth session check
    const authStart = Date.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      results.push({
        name: "Auth Session",
        status: data.session ? "ok" : "warning",
        message: data.session 
          ? `Logged in as ${data.session.user.email}` 
          : error ? `Error: ${error.message}` : "No active session",
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

    // 3. Check-subscription function
    const subStart = Date.now();
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke("check-subscription"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 10s")), 10000)),
      ]);
      results.push({
        name: "check-subscription",
        status: error ? "error" : "ok",
        message: error 
          ? `Error: ${error.message}` 
          : `subscribed=${data?.subscribed}, trialing=${data?.is_trialing}`,
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

    // 4. create-checkout function (dry-run style, just check it responds)
    const checkoutStart = Date.now();
    try {
      const { data, error } = await Promise.race([
        supabase.functions.invoke("create-checkout"),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 10s")), 10000)),
      ]);
      results.push({
        name: "create-checkout",
        status: error ? "error" : "ok",
        message: error 
          ? `Error: ${error.message}` 
          : data?.url ? "Checkout URL generated" : "No URL returned (may be subscribed)",
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
        <div className="bg-card rounded-2xl p-4 shadow-soft space-y-2">
          <h2 className="font-semibold text-foreground">Auth Status</h2>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">User:</span> {user ? user.email : "Not logged in"}</p>
            <p><span className="font-medium text-foreground">Session:</span> {session ? "Active" : "None"}</p>
            <p><span className="font-medium text-foreground">Auth Loading:</span> {authLoading ? "Yes" : "No"}</p>
          </div>
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
