import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";

const PostCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success">("loading");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Brief pause so user sees confirmation, then redirect to home
    const timer = setTimeout(() => {
      setStatus("success");
    }, 1000);

    const redirect = setTimeout(() => {
      navigate("/", { replace: true });
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(redirect);
    };
  }, [navigate, sessionId]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4">
        {status === "loading" ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Confirming your subscription…</p>
          </>
        ) : (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
            <p className="text-muted-foreground">Your 7-day free trial has started. Redirecting…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default PostCheckout;
