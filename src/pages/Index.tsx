import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { WearableConnection } from "@/components/WearableConnection";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { Dashboard } from "@/components/Dashboard";
import { Sparkles, Heart, Brain, Zap } from "lucide-react";
import cjtLogo from "@/assets/cjt-logo.png";

type AppState = "welcome" | "connection" | "questionnaire" | "baseline" | "dashboard";

const Index = () => {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [userData, setUserData] = useState<OnboardingData | null>(null);

  // Check if user has completed onboarding
  useEffect(() => {
    const hasOnboarded = localStorage.getItem("cjt_onboarded");
    if (hasOnboarded) {
      const savedData = localStorage.getItem("cjt_user_data");
      if (savedData) {
        setUserData(JSON.parse(savedData));
      }
      setAppState("dashboard");
    }
  }, []);

  const handleGetStarted = () => {
    setAppState("connection");
  };

  const handleConnectionChoice = (type: "wearable" | "questionnaire") => {
    if (type === "questionnaire") {
      setAppState("questionnaire");
    } else {
      // In a real app, this would open wearable connection flow
      // For now, skip to dashboard
      localStorage.setItem("cjt_onboarded", "true");
      setAppState("dashboard");
    }
  };

  const handleQuestionnaireComplete = (data: OnboardingData) => {
    console.log("Onboarding data:", data);
    localStorage.setItem("cjt_user_data", JSON.stringify(data));
    setUserData(data);
    setAppState("baseline");
  };

  const handleBaselineContinue = () => {
    localStorage.setItem("cjt_onboarded", "true");
    setAppState("dashboard");
  };

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
        <p className="text-xl text-muted-foreground mb-8 max-w-sm animate-slide-up delay-100">
          Your AI-powered nutrition coach in your pocket
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10 w-full max-w-sm animate-slide-up delay-200">
          {[
            { icon: <Brain className="w-6 h-6" />, label: "AI Powered" },
            { icon: <Zap className="w-6 h-6" />, label: "Quick Logging" },
            { icon: <Heart className="w-6 h-6" />, label: "Personalized" },
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
            "Finally, a nutrition app that actually understands my lifestyle. It is like having a coach in my pocket!"
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
          Get Started Free
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No credit card required • Cancel anytime
        </p>
      </div>
    </div>
  );
};

export default Index;
