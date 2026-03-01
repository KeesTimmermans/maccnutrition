import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Loader2, Mail } from "lucide-react";
import macLogo from "@/assets/mac-nutrition-logo.png";
import { z } from "zod";

const passwordSchema = z.string().min(10, "Password must be at least 10 characters");

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery session from the magic link
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check URL hash for recovery type
      const hash = window.location.hash;
      const hasRecoveryToken = hash.includes("type=recovery") || hash.includes("access_token");
      setHasSession(!!(session || hasRecoveryToken));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) newErrors.password = err.errors[0].message;
    }

    if (password !== confirmPassword) {
      newErrors.confirm = "Passwords do not match";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password updated", description: "You can now log in with your new password." });
        navigate("/");
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      const appUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: appUrl + "#/reset-password",
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Email sent", description: "Check your inbox for the reset link." });
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Still checking session
  if (hasSession === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src={macLogo} alt="MacNutrition" className="h-16 mx-auto" style={{ mixBlendMode: "multiply" }} />
          <h1 className="text-2xl font-bold text-foreground mt-3">Reset Password</h1>
        </div>

        {hasSession ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
              {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
            </div>

            <p className="text-xs text-muted-foreground">Minimum 10 characters.</p>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Set New Password"
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground text-sm">
              This reset link has expired or is invalid. Enter your email to receive a new one.
            </p>
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
            </div>
            <Button onClick={handleResend} variant="hero" size="lg" className="w-full" disabled={resendLoading || !resendEmail}>
              {resendLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Re-send Reset Email"
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
