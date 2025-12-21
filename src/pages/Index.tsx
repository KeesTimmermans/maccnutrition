import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WearableConnection } from "@/components/WearableConnection";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { Dashboard } from "@/components/Dashboard";
import { Sparkles, Heart, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserBaseline, saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateBaseline } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";
import cjtLogo from "@/assets/cjt-logo.png";

type AppState = "welcome" | "connection" | "questionnaire" | "baseline" | "dashboard";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for existing baseline data
  useEffect(() => {
    const checkUserBaseline = async () => {
      if (authLoading) return;
      
      if (user) {
        try {
          const baseline = await getUserBaseline(user.id);
          if (baseline) {
            // User has completed onboarding
            setAppState("dashboard");
          } else {
            // User is authenticated but hasn't completed onboarding
            setAppState("connection");
          }
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
  }, [user, authLoading]);

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

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <img src={cjtLogo} alt="CJT Nutrition" className="w-32 h-auto opacity-50" />
          <p className="text-muted-foreground">Loading...</p>
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
            "Finally, a nutrition app that actually understands my lifestyle and helps me stay on track!"
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
