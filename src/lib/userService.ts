import { supabase } from "@/integrations/supabase/client";
import { OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineResults } from "@/lib/baselineCalculations";

export interface UserBaseline {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  age: number | null;
  sex: string | null;
  unit_system: string | null;
  height_feet: number | null;
  height_inches: number | null;
  height_cm: number | null;
  weight: number | null;
  conditions: string[] | null;
  allergies: string[] | null;
  occupation: string | null;
  work_hours: string | null;
  training_days: string | null;
  training_intensity: string | null;
  sleep_hours: string | null;
  activity_level: string | null;
  stress_level: string | null;
  primary_goal: string | null;
  secondary_goals: string[] | null;
  diet_type: string | null;
  food_dislikes: string | null;
  coaching_tone: string | null;
  meals_per_day: string | null;
  cycle_regularity: string | null;
  current_phase: string | null;
  cycle_symptoms: string[] | null;
  tdee: number | null;
  target_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fats_grams: number | null;
  water_liters: number | null;
  sodium_mg: number | null;
  magnesium_mg: number | null;
  potassium_mg: number | null;
  focus_points: string[] | null;
  preferred_language: string | null;
}

export const saveUserBaseline = async (
  userId: string,
  onboardingData: OnboardingData,
  baseline: BaselineResults
) => {
  const { data, error } = await supabase
    .from("user_baselines")
    .upsert({
      user_id: userId,
      age: onboardingData.age ? parseInt(onboardingData.age) : null,
      sex: onboardingData.sex || null,
      unit_system: onboardingData.unitSystem || "imperial",
      height_feet: onboardingData.heightFeet ? parseInt(onboardingData.heightFeet) : null,
      height_inches: onboardingData.heightInches ? parseInt(onboardingData.heightInches) : null,
      height_cm: onboardingData.heightCm ? parseFloat(onboardingData.heightCm) : null,
      weight: onboardingData.weight ? parseFloat(onboardingData.weight) : null,
      conditions: onboardingData.conditions,
      allergies: onboardingData.allergies,
      occupation: onboardingData.occupation || null,
      work_hours: onboardingData.workHours || null,
      training_days: onboardingData.trainingDays || null,
      training_intensity: onboardingData.trainingIntensity || null,
      sleep_hours: onboardingData.sleepHours || null,
      activity_level: onboardingData.activityLevel || null,
      stress_level: onboardingData.stressLevel || null,
      primary_goal: onboardingData.primaryGoal || null,
      secondary_goals: onboardingData.secondaryGoals,
      diet_type: onboardingData.dietType || null,
      food_dislikes: onboardingData.foodDislikes || null,
      coaching_tone: onboardingData.coachingTone || null,
      meals_per_day: onboardingData.mealsPerDay || null,
      cycle_regularity: onboardingData.cycleRegularity || null,
      current_phase: onboardingData.currentPhase || null,
      cycle_symptoms: onboardingData.cycleSymptoms,
      tdee: baseline.calories.tdee,
      target_calories: baseline.calories.target,
      protein_grams: baseline.macros.protein.grams,
      carbs_grams: baseline.macros.carbs.grams,
      fats_grams: baseline.macros.fats.grams,
      water_liters: baseline.hydration.waterLiters,
      sodium_mg: baseline.hydration.sodiumMg,
      magnesium_mg: baseline.hydration.magnesiumMg,
      potassium_mg: baseline.hydration.potassiumMg,
      focus_points: baseline.focusPoints,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving user baseline:", error);
    throw error;
  }

  return data;
};

export const getUserBaseline = async (userId?: string): Promise<UserBaseline | null> => {
  let uid = userId;
  
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
  }

  const { data, error } = await supabase
    .from("user_baselines")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user baseline:", error);
    throw error;
  }

  return data as UserBaseline | null;
};

export const getAICoachingResponse = async (
  message: string,
  userContext: {
    coachingTone?: string;
    primaryGoal?: string;
    targetCalories?: number;
    proteinGrams?: number;
    activityLevel?: string;
    sleepHours?: string;
    stressLevel?: string;
    focusPoints?: string[];
  },
  type: "chat" | "meal_feedback" | "daily_checkin" | "focus_tip" = "chat"
) => {
  const { data, error } = await supabase.functions.invoke("ai-coach", {
    body: { message, userContext, type },
  });

  if (error) {
    console.error("Error calling AI coach:", error);
    throw error;
  }

  return data;
};

export const updateUserSettings = async (settings: { unit_system?: string }) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_baselines")
    .update(settings)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }

  return data as UserBaseline;
};

/**
 * Send baseline summary email after onboarding
 */
export const sendBaselineEmail = async (
  email: string,
  userName: string | undefined,
  baseline: BaselineResults,
  primaryGoal: string,
  mealPattern: { meal: string; time: string; purpose: string }[]
) => {
  try {
    const { data, error } = await supabase.functions.invoke("send-baseline-email", {
      body: {
        email,
        userName,
        baseline: {
          targetCalories: baseline.calories.target,
          proteinGrams: baseline.macros.protein.grams,
          carbsGrams: baseline.macros.carbs.grams,
          fatsGrams: baseline.macros.fats.grams,
          waterLiters: baseline.hydration.waterLiters,
          sodiumMg: baseline.hydration.sodiumMg,
          magnesiumMg: baseline.hydration.magnesiumMg,
          potassiumMg: baseline.hydration.potassiumMg,
          focusPoints: baseline.focusPoints,
          primaryGoal,
        },
        mealPattern,
      },
    });

    if (error) {
      console.error("Error sending baseline email:", error);
      return { success: false, error };
    }

    console.log("Baseline email sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error invoking send-baseline-email:", error);
    return { success: false, error };
  }
};
