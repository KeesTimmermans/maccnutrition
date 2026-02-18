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

const PRIVACY_POLICY_VERSION = "1.0";

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
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    name?: string;
    terms?: string;
    health?: string;
  }>({});
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  const getCheckoutReturnUrl = () => {
    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : `${window.location.pathname}/`;
    return `${window.location.origin}${basePath}#/`;
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const newErrors: {
      email?: string;
      password?: string;
      name?: string;
      terms?: string;
      health?: string;
    } = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.email = e.errors[0].message;
    }

    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.password = e.errors[0].message;
    }

    if (!isLogin) {
      try {
        nameSchema.parse(name);
      } catch (e) {
        if (e instanceof z.ZodError) newErrors.name = e.errors[0].message;
      }

      if (!acceptedTerms) {
        newErrors.terms = "You must accept the Privacy Policy and Terms & Conditions to continue.";
      }
      if (!acceptedHealthConsent) {
        newErrors.health = "You must consent to health data processing to continue.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        return;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { first_name: name },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account exists",
            description: "This email is already registered. Please log in instead.",
            variant: "destructive",
          });
          setIsLogin(true);
        } else {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      if (!signUpData.session) {
        toast({
          title: "Check your email",
          description: "Please confirm your email, then log in to start your 14-day trial.",
        });
        setIsLogin(true);
        return;
      }

      // Upsert consent record into user_baselines
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

      try {
        const { data: checkoutData, error: checkoutError } = await Promise.race([
          supabase.functions.invoke("create-checkout", { body: { return_url: getCheckoutReturnUrl() } }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Checkout timed out")), 12000)),
        ]);

        if (checkoutError) throw checkoutError;

        const url = checkoutData?.url as string | undefined;
        if (url) {
          const inIframe = (() => {
            try { return window.self !== window.top; } catch { return true; }
          })();

          if (inIframe) {
            setCheckoutUrl(url);
            toast({ title: "Almost there", description: "Open checkout in a new tab to start your 14-day trial." });
          } else {
            window.location.assign(url);
          }
        } else {
          toast({ title: "Account created!", description: "Please complete your subscription to continue." });
        }
      } catch (checkoutErr) {
        console.error("Checkout error:", checkoutErr);
        toast({ title: "Account created!", description: "You can now continue with setup." });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
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
              : "Start your personalized nutrition journey"}
          </p>
        </div>

        {/* Checkout helper */}
        {checkoutUrl && !isLogin && (
          <div className="mb-6 bg-card rounded-2xl p-4 shadow-soft space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Complete your trial signup</p>
              <p className="text-sm text-muted-foreground">
                If checkout didn't open automatically, use the button below to open it in a new tab.
              </p>
            </div>
            <Button
              variant="hero"
              className="w-full"
              onClick={() => {
                const opened = window.open(checkoutUrl, "_blank", "noopener,noreferrer");
                if (!opened) window.location.assign(checkoutUrl);
              }}
            >
              Open Checkout
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setCheckoutUrl(null); setIsLogin(true); }}
            >
              I already subscribed — Log in
            </Button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field - signup only */}
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="name">First Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-12 rounded-xl"
                />
              </div>
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12 rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          {/* Consent checkboxes — signup only */}
          {!isLogin && (
            <div className="space-y-3 pt-1">
              {/* Required: Terms & Privacy */}
              <div className="space-y-1">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(v) => {
                      setAcceptedTerms(!!v);
                      if (v) setErrors((prev) => ({ ...prev, terms: undefined }));
                    }}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I agree to the{" "}
                    <a
                      href="#/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a
                      href="#/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Terms &amp; Conditions
                    </a>
                    {" "}<span className="text-destructive">*</span>
                  </label>
                </div>
                {errors.terms && (
                  <p className="text-sm text-destructive pl-7">{errors.terms}</p>
                )}
              </div>

              {/* Required: Health data consent */}
              <div className="space-y-1">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="health-consent"
                    checked={acceptedHealthConsent}
                    onCheckedChange={(v) => {
                      setAcceptedHealthConsent(!!v);
                      if (v) setErrors((prev) => ({ ...prev, health: undefined }));
                    }}
                    className="mt-0.5"
                  />
                  <label htmlFor="health-consent" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    I consent to the processing of my health-related data as described in the{" "}
                    <a
                      href="#/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Policy
                    </a>
                    {" "}<span className="text-destructive">*</span>
                  </label>
                </div>
                {errors.health && (
                  <p className="text-sm text-destructive pl-7">{errors.health}</p>
                )}
              </div>

              {/* Optional: Marketing emails */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="marketing"
                  checked={acceptedMarketing}
                  onCheckedChange={(v) => setAcceptedMarketing(!!v)}
                  className="mt-0.5"
                />
                <label htmlFor="marketing" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                  I want to receive marketing emails and product updates. (Optional)
                </label>
              </div>

              <p className="text-xs text-muted-foreground pl-0">
                <span className="text-destructive">*</span> Required
              </p>
            </div>
          )}

          <Button
            type="submit"
            variant="hero"
            size="lg"
            className="w-full"
            disabled={loading || (!!checkoutUrl && !isLogin) || (!isLogin && !requiredConsentsChecked)}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isLogin ? "Logging in..." : "Creating account..."}
              </>
            ) : isLogin ? (
              "Log In"
            ) : checkoutUrl ? (
              "Checkout Ready"
            ) : (
              "Sign Up & Subscribe"
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <p className="text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setCheckoutUrl(null);
                setErrors({});
                setAcceptedTerms(false);
                setAcceptedHealthConsent(false);
                setAcceptedMarketing(false);
              }}
              className="ml-2 text-primary font-semibold hover:underline"
            >
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>

        {/* Legal footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground space-x-3">
          <a
            href="#/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="#/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Terms &amp; Conditions
          </a>
        </div>
      </div>
    </div>
  );
};

export default Auth;
