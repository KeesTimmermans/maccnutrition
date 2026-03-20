import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PostCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const verifyAndRedirect = async () => {
      try {
        // Ensure we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Not logged in — redirect to auth
          navigate("/auth", { replace: true });
          return;
        }

        // Call check-subscription to verify the subscription status
        // This also ensures the subscription data is fresh in useAuth
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) throw error;

        const isActive = data?.subscribed === true;
        if (isActive) {
          setStatus("success");
          // Short delay so user sees the confirmation, then go to app
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 2000);
        } else {
          // Subscription not yet active — retry once after a short delay
          // (Stripe webhook may take a moment)
          await new Promise(resolve => setTimeout(resolve, 3000));
          const { data: retry } = await supabase.functions.invoke("check-subscription");
          if (retry?.subscribed) {
            setStatus("success");
            setTimeout(() => {
              navigate("/dashboard", { replace: true });
            }, 2000);
          } else {
            setStatus("error");
          }
        }
      } catch (err) {
        console.error("Post-checkout verification error:", err);
        setStatus("error");
      }
    };

    verifyAndRedirect();
  }, [navigate, sessionId]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Confirming your subscription…</h1>
            <p className="text-muted-foreground text-sm">This will only take a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
            <p className="text-muted-foreground">Your 7-day free trial has started. Let's set up your profile…</p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              We couldn't verify your subscription. If you completed payment, it may take a moment to process.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => { setStatus("loading"); window.location.reload(); }}>
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate("/", { replace: true })}>
                Go to Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PostCheckout;
