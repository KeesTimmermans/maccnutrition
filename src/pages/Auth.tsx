import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, Loader2, User } from "lucide-react";
import macLogo from "@/assets/mac-nutrition-logo.png";
import { z } from "zod";
import { PRIVACY_POLICY_VERSION } from "@/lib/consentConstants";
import { trackSignedUp, trackTrialStarted } from "@/lib/analytics";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "First name must be at least 2 characters");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedHealthConsent, setAcceptedHealthConsent] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
    terms?: string;
    health?: string;
  }>({});

  const navigate = useNavigate();
  const { toast } = useToast();

  const getCheckoutReturnUrl = () => {
    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return `${window.location.origin}${basePath}`;
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only auto-navigate for login; signup flow handles its own redirect
      if (session && isLogin) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isLogin) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isLogin]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    try { emailSchema.parse(email); } catch (e) {
      if (e instanceof z.ZodError) newErrors.email = e.errors[0].message;
    }
    try { passwordSchema.parse(password); } catch (e) {
      if (e instanceof z.ZodError) newErrors.password = e.errors[0].message;
    }

    if (!isLogin) {
      try { nameSchema.parse(name); } catch (e) {
        if (e instanceof z.ZodError) newErrors.name = e.errors[0].message;
      }
      if (!acceptedTerms) newErrors.terms = "You must accept the Privacy Policy and Terms & Conditions to continue.";
      if (!acceptedHealthConsent) newErrors.health = "You must consent to health data processing to continue.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const redirectToOnboarding = () => {
    navigate("/onboarding");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast({
            title: "Login failed",
            description: error.message.includes("Invalid login credentials")
              ? "Invalid email or password. Please try again."
              : error.message,
            variant: "destructive",
          });
        }
        // onAuthStateChange will navigate on success
        return;
      }

      // ── Sign Up ──
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: name },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({ title: "Account exists", description: "This email is already registered. Please log in instead.", variant: "destructive" });
          setIsLogin(true);
        } else {
          toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
        }
        return;
      }

      if (!signUpData.session) {
        // Shouldn't happen with auto-confirm enabled, but fallback
        toast({ title: "Check your email", description: "Please confirm your email, then log in." });
        setIsLogin(true);
        return;
      }

      // Persist consent records
      const now = new Date().toISOString();
      await supabase.from("user_baselines").upsert(
        {
          user_id: signUpData.session.user.id,
          privacy_policy_accepted: true,
          privacy_policy_version: PRIVACY_POLICY_VERSION,
          privacy_policy_accepted_at: now,
          health_data_consent: true,
          marketing_opt_in: acceptedMarketing,
          marketing_opt_in_at: acceptedMarketing ? now : null,
        },
        { onConflict: "user_id" }
      );

      const consentRows: Array<{
        user_id: string; consent_type: string; policy_version: string; accepted: boolean; accepted_at: string;
      }> = [
        { user_id: signUpData.session.user.id, consent_type: "privacy", policy_version: PRIVACY_POLICY_VERSION, accepted: true, accepted_at: now },
        { user_id: signUpData.session.user.id, consent_type: "health", policy_version: PRIVACY_POLICY_VERSION, accepted: true, accepted_at: now },
      ];
      if (acceptedMarketing) {
        consentRows.push({ user_id: signUpData.session.user.id, consent_type: "marketing", policy_version: PRIVACY_POLICY_VERSION, accepted: true, accepted_at: now });
      }
      await supabase.from("consent_log").insert(consentRows);

      trackSignedUp();

      // Redirect to onboarding questionnaire (payment comes after)
      redirectToOnboarding();
    } catch (_error) {
      toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const requiredConsentsChecked = acceptedTerms && acceptedHealthConsent;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <img src={macLogo} alt="MAC Nutrition" className="h-16 mx-auto" style={{ mixBlendMode: 'multiply' }} />
          <h1 className="text-2xl font-bold text-foreground mt-3">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLogin
              ? "Log in to continue your nutrition journey"
              : "Start your 7-day free trial"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="name" type="text" placeholder="Enter your first name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-12 rounded-xl" />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12 rounded-xl" />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-12 rounded-xl" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          {isLogin && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
          </div>

          {/* Consent checkboxes — signup only */}
          {!isLogin && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => { setAcceptedTerms(!!v); if (v) setErrors((prev) => ({ ...prev, terms: undefined })); }} className="mt-0.5" />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I agree to the{" "}
                    <a href="#/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Privacy Policy</a>{" "}and{" "}
                    <a href="#/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Terms &amp; Conditions</a>
                    {" "}<span className="text-destructive">*</span>
                  </label>
                </div>
                {errors.terms && <p className="text-sm text-destructive pl-7">{errors.terms}</p>}
              </div>

              <div className="space-y-1">
                <div className="flex items-start gap-3">
                  <Checkbox id="health-consent" checked={acceptedHealthConsent} onCheckedChange={(v) => { setAcceptedHealthConsent(!!v); if (v) setErrors((prev) => ({ ...prev, health: undefined })); }} className="mt-0.5" />
                  <label htmlFor="health-consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I consent to the processing of my health-related data as described in the{" "}
                    <a href="#/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Privacy Policy</a>
                    {" "}<span className="text-destructive">*</span>
                  </label>
                </div>
                {errors.health && <p className="text-sm text-destructive pl-7">{errors.health}</p>}
              </div>

              <div className="flex items-start gap-3">
                <Checkbox id="marketing" checked={acceptedMarketing} onCheckedChange={(v) => setAcceptedMarketing(!!v)} className="mt-0.5" />
                <label htmlFor="marketing" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                  I want to receive marketing emails and product updates. (Optional)
                </label>
              </div>

              <p className="text-xs text-muted-foreground"><span className="text-destructive">*</span> Required</p>
            </div>
          )}

          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || (!isLogin && !requiredConsentsChecked)}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isLogin ? "Logging in..." : "Creating account..."}
              </>
            ) : isLogin ? "Log In" : "Sign Up & Start Free Trial"}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setIsLogin(!isLogin); setErrors({}); setAcceptedTerms(false); setAcceptedHealthConsent(false); setAcceptedMarketing(false); }} className="ml-2 text-primary font-semibold hover:underline">
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>

        {/* Forgot password modal */}
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
            <div className="bg-background rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>Cancel</Button>
                <Button
                  variant="hero"
                  className="flex-1"
                  disabled={forgotLoading || !forgotEmail}
                  onClick={async () => {
                    setForgotLoading(true);
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                        redirectTo: "https://macnutrition.lovable.app/reset-password",
                      });
                      if (error) {
                        toast({ title: "Error", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: "Email sent", description: "Check your inbox for the reset link." });
                        setShowForgot(false);
                      }
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                >
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Link"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Legal footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground space-x-3">
          <a href="#/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">Privacy Policy</a>
          <span>·</span>
          <a href="#/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">Terms &amp; Conditions</a>
        </div>
      </div>
    </div>
  );
};

export default Auth;
