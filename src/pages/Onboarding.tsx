import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingQuestionnaire, OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineSummary } from "@/components/BaselineSummary";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/App";
import { saveUserBaseline, sendBaselineEmail } from "@/lib/userService";
import { calculateNutritionTargets, BaselineResults } from "@/lib/baselineCalculations";
import { useToast } from "@/hooks/use-toast";
import { createCompPrep } from "@/lib/competitionPrep/service";
import { syncOnboardingCompleted } from "@/lib/mailerliteSync";
import type { CompetitionPrepInput, EventType, CompGoal, CompDivision } from "@/lib/competitionPrep/types";

const VALID_EVENT_TYPES: EventType[] = ["hyrox", "athx", "5k", "10k", "half_marathon", "full_marathon"];

const Onboarding = () => {
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [savedBaseline, setSavedBaseline] = useState<BaselineResults | null>(null);
  const [showBaseline, setShowBaseline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { markOnboardingCompleted } = useOnboarding();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleQuestionnaireComplete = async (data: OnboardingData) => {
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in before completing onboarding.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // 1. Calculate baseline ONCE
      const baseline = calculateNutritionTargets(data);

      // 2. Save to user_baselines — this MUST succeed before proceeding
      await saveUserBaseline(user.id, data, baseline);

      if (import.meta.env.DEV) {
        console.log("[Onboarding] Baseline saved successfully for user", user.id);
      }

      // 3. Fire-and-forget email (non-blocking)
      if (user.email) {
        sendBaselineEmail(
          user.email,
          data.name || user.user_metadata?.full_name || user.email.split("@")[0],
          baseline,
          data.primaryGoal,
          baseline.mealPattern,
        ).catch((err) => console.error("Failed to send baseline email:", err));
      }

      // 4. Auto-create Competition Prep if user selected event during onboarding
      if (data.preparingForEvent === "yes" && data.compEventType && data.compEventDate && data.compGoal) {
        try {
          const eventType: EventType = VALID_EVENT_TYPES.includes(data.compEventType as EventType)
            ? (data.compEventType as EventType)
            : "hyrox"; // fallback for "other"

          const weightKg = data.unitSystem === "imperial"
            ? Number(data.weight) / 2.205
            : Number(data.weight);

          const prepInput: CompetitionPrepInput = {
            eventType,
            eventDate: data.compEventDate,
            division: (data.compDivision || "open") as CompDivision,
            primaryGoal: data.compGoal as CompGoal,
          };

          await createCompPrep(prepInput, weightKg, baseline.calories.tdee);

          if (import.meta.env.DEV) {
            console.log("[Onboarding] Competition Prep auto-created for user", user.id);
          }
        } catch (compErr) {
          // Non-blocking — log but don't fail onboarding
          console.error("[Onboarding] Competition Prep auto-creation failed:", compErr);
        }
      }

      // 5. Only on success: persist locally and show summary
      localStorage.setItem("cjt_user_data", JSON.stringify(data));
      setUserData(data);
      setSavedBaseline(baseline);
      setShowBaseline(true);

      toast({
        title: "Profile saved!",
        description: data.preparingForEvent === "yes"
          ? "Your personalized baseline and competition prep have been created."
          : "Your personalized baseline has been created.",
      });
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("[Onboarding] Save failed:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
      }
      toast({
        title: "We couldn't save your onboarding",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaselineContinue = async () => {
    try {
      // Mark onboarding complete — this updates profiles AND context state
      await markOnboardingCompleted();
      localStorage.setItem("cjt_onboarded", "true");

      // Fire-and-forget: sync to MailerLite
      if (user?.email) {
        syncOnboardingCompleted(
          user.email,
          userData?.name || user.user_metadata?.full_name || user.email.split("@")[0],
        );
      }

      // Navigate to pricing/checkout — app access requires active subscription
      navigate("/pricing");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("[Onboarding] markOnboardingCompleted failed:", error);
      }
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (showBaseline && userData && savedBaseline) {
    return <BaselineSummary userData={userData} baseline={savedBaseline} onContinue={handleBaselineContinue} />;
  }

  return <OnboardingQuestionnaire onComplete={handleQuestionnaireComplete} />;
};

export default Onboarding;
