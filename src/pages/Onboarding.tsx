import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/App";
import { saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateNutritionTargets, BaselineResults } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [savedBaseline, setSavedBaseline] = useState<BaselineResults | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const { user } = useAuth();
  const { markOnboardingCompleted } = useOnboarding();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (data: OnboardingData) => {
    setUserData(data);

    // Calculate baseline ONCE — this same object is saved to DB and shown in summary
    const baseline = calculateNutritionTargets(data);

    if (user) {
      try {
        await saveUserBaseline(user.id, data, baseline);

        if (user.email) {
          sendBaselineEmail(
            user.email,
            user.user_metadata?.full_name || user.email.split("@")[0],
            baseline,
            data.primaryGoal,
            baseline.mealPattern,
          ).catch((err) => console.error("Failed to send baseline email:", err));
        }

        toast({
          title: "Profile saved!",
          description: "Your personalized baseline has been created.",
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

    localStorage.setItem("cjt_user_data", JSON.stringify(data));
    setSavedBaseline(baseline);
    setShowBaseline(true);
  };

  const handleBaselineContinue = async () => {
    localStorage.setItem("cjt_onboarded", "true");
    await markOnboardingCompleted();
    navigate("/");
  };

  if (showBaseline && userData && savedBaseline) {
    return <BaselineSummary userData={userData} baseline={savedBaseline} onContinue={handleBaselineContinue} />;
  }

  return <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />;
};

export default Onboarding;
