import { supabase } from "@/integrations/supabase/client";
import { OnboardingData } from "@/components/OnboardingQuestionnaire";
import { BaselineResults, calculateHydration } from "@/lib/baselineCalculations";

export interface UserBaseline {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string | null;
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
  // Behavioral fields
  eating_speed: string | null;
  hunger_patterns: string | null;
  cravings_triggers: string[] | null;
  emotional_eating: string | null;
  biggest_challenge: string | null;
  past_diets: string[] | null;
  motivation_style: string | null;
  accountability_preference: string | null;
  meal_prep_time: string | null;
  cooking_skill: string | null;
  eating_out_frequency: string | null;
  snacking_habits: string | null;
  hydration_habits: string | null;
  energy_patterns: string | null;
  weekend_habits: string | null;
  protein_shakes_preference: string | null;
  preferred_currency: string | null;
  dashboard_layout: {
    sections: string[];
    hidden: string[];
  } | null;
  // New fields
  job_activity_level: string | null;
  workout_types: string[] | null;
  climate: string | null;
  training_duration: string | null;
  body_fat_percentage: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
  progress_photo_url: string | null;
  progress_photo_front: string | null;
  progress_photo_back: string | null;
  progress_photo_left: string | null;
  progress_photo_right: string | null;
  measurements_updated_at: string | null;
  last_progress_update: string | null;
  // Reminder fields
  reminders_enabled: boolean | null;
  reminder_meal_logging: boolean | null;
  reminder_water_logging: boolean | null;
  reminder_weekly_summary: boolean | null;
  reminder_frequency: string | null;
  reminder_time: string | null;
  reminder_timezone: string | null;
  reminder_quiet_start: string | null;
  reminder_quiet_end: string | null;
  last_meal_reminder_sent: string | null;
  last_water_reminder_sent: string | null;
  last_weekly_summary_sent: string | null;
}

export const saveUserBaseline = async (
  userId: string,
  onboardingData: OnboardingData,
  baseline: BaselineResults
) => {
  // Get user name from auth metadata (support both first_name and legacy full_name)
  const { data: { user } } = await supabase.auth.getUser();
  // Extract first name - handle full_name by taking just the first part
  let userName = user?.user_metadata?.first_name;
  if (!userName && user?.user_metadata?.full_name) {
    userName = user.user_metadata.full_name.split(' ')[0];
  }
  if (!userName && onboardingData.name) {
    userName = onboardingData.name.split(' ')[0]; // Ensure it's just first name
  }
  
  const { data, error } = await supabase
    .from("user_baselines")
    .upsert({
      user_id: userId,
      name: userName,
      age: onboardingData.age ? parseInt(onboardingData.age) : null,
      sex: onboardingData.sex || null,
      unit_system: onboardingData.unitSystem || "metric",
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
      // Baseline calculations
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
      // Behavioral fields
      eating_speed: onboardingData.eatingSpeed || null,
      hunger_patterns: onboardingData.hungerPatterns || null,
      cravings_triggers: onboardingData.cravingsTriggers,
      emotional_eating: onboardingData.emotionalEating || null,
      biggest_challenge: onboardingData.biggestChallenge || null,
      past_diets: onboardingData.pastDiets,
      motivation_style: onboardingData.motivationStyle || null,
      accountability_preference: onboardingData.accountabilityPreference || null,
      meal_prep_time: onboardingData.mealPrepTime || null,
      cooking_skill: onboardingData.cookingSkill || null,
      eating_out_frequency: onboardingData.eatingOutFrequency || null,
      snacking_habits: onboardingData.snackingHabits || null,
      hydration_habits: onboardingData.hydrationHabits || null,
      energy_patterns: onboardingData.energyPatterns || null,
      weekend_habits: onboardingData.weekendHabits || null,
      protein_shakes_preference: onboardingData.proteinShakesPreference || null,
      // New fields
      job_activity_level: onboardingData.jobActivityLevel || null,
      workout_types: onboardingData.workoutTypes,
      climate: onboardingData.climate || null,
      training_duration: onboardingData.trainingDuration || null,
      // Measurements (optional during onboarding)
      body_fat_percentage: onboardingData.bodyFatPercentage ? parseFloat(onboardingData.bodyFatPercentage) : null,
      waist_cm: onboardingData.waist ? parseFloat(onboardingData.waist) : null,
      hip_cm: onboardingData.hip ? parseFloat(onboardingData.hip) : null,
      chest_cm: onboardingData.chest ? parseFloat(onboardingData.chest) : null,
      arm_cm: onboardingData.arm ? parseFloat(onboardingData.arm) : null,
      thigh_cm: onboardingData.thigh ? parseFloat(onboardingData.thigh) : null,
      neck_cm: onboardingData.neck ? parseFloat(onboardingData.neck) : null,
      progress_photo_url: onboardingData.progressPhotoUrl || onboardingData.progressPhotos?.front || null,
      progress_photo_front: onboardingData.progressPhotos?.front || null,
      progress_photo_back: onboardingData.progressPhotos?.back || null,
      progress_photo_left: onboardingData.progressPhotos?.left || null,
      progress_photo_right: onboardingData.progressPhotos?.right || null,
      measurements_updated_at: (onboardingData.waist || onboardingData.bodyFatPercentage || onboardingData.progressPhotoUrl || Object.values(onboardingData.progressPhotos || {}).some(v => v)) ? new Date().toISOString() : null,
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

  return data as unknown as UserBaseline | null;
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
    // New behavioral context
    eatingSpeed?: string;
    hungerPatterns?: string;
    cravingsTriggers?: string[];
    emotionalEating?: string;
    biggestChallenge?: string;
    motivationStyle?: string;
    weekendHabits?: string;
    energyPatterns?: string;
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

export const updateUserSettings = async (settings: { 
  unit_system?: string; 
  preferred_currency?: string;
  coaching_tone?: string;
  dashboard_layout?: { sections: string[]; hidden: string[] };
}) => {
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

  return data as unknown as UserBaseline;
};

/**
 * Update user body measurements
 */
export const updateUserMeasurements = async (measurements: {
  body_fat_percentage?: number | null;
  waist_cm?: number | null;
  hip_cm?: number | null;
  chest_cm?: number | null;
  arm_cm?: number | null;
  thigh_cm?: number | null;
  neck_cm?: number | null;
  weight?: number | null;
  progress_photo_url?: string | null;
  progress_photo_front?: string | null;
  progress_photo_back?: string | null;
  progress_photo_left?: string | null;
  progress_photo_right?: string | null;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_baselines")
    .update({
      ...measurements,
      measurements_updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating measurements:", error);
    throw error;
  }

  const baseline = data as unknown as UserBaseline;

  // Auto-recalculate hydration when weight changes
  if (measurements.weight != null) {
    await recalculateHydrationFromBaseline(baseline);
  }

  return baseline;
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

/**
 * Convert a UserBaseline record into the shape calculateHydration expects,
 * then persist the recalculated hydration targets.
 */
export const recalculateHydrationFromBaseline = async (
  baseline: UserBaseline
): Promise<UserBaseline | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Build a minimal OnboardingData from stored baseline fields
  const pseudo: OnboardingData = {
    name: baseline.name || "",
    age: baseline.age?.toString() || "",
    sex: (baseline.sex as "male" | "female" | "") || "",
    unitSystem: (baseline.unit_system as "imperial" | "metric") || "metric",
    heightFeet: baseline.height_feet?.toString() || "",
    heightInches: baseline.height_inches?.toString() || "",
    heightCm: baseline.height_cm?.toString() || "",
    weight: baseline.weight?.toString() || "70",
    conditions: baseline.conditions || [],
    allergies: baseline.allergies || [],
    occupation: baseline.occupation || "",
    workHours: baseline.work_hours || "",
    trainingDays: baseline.training_days || "2-3",
    trainingIntensity: baseline.training_intensity || "",
    sleepHours: baseline.sleep_hours || "7-8",
    activityLevel: baseline.activity_level || "semi_active",
    stressLevel: baseline.stress_level || "moderate",
    jobActivityLevel: baseline.job_activity_level || "light",
    workoutTypes: baseline.workout_types || [],
    climate: baseline.climate || "moderate",
    trainingDuration: baseline.training_duration || "30_60",
    primaryGoal: baseline.primary_goal || "general_health",
    currentPhase: baseline.current_phase || "",
    // Remaining fields with safe defaults (not used by hydration calc)
    eatingSpeed: "", hungerPatterns: "", cravingsTriggers: [],
    emotionalEating: "", snackingHabits: "", hydrationHabits: "",
    biggestChallenge: "", pastDiets: [], weekendHabits: "",
    eatingOutFrequency: "", mealPrepTime: "", cookingSkill: "",
    energyPatterns: "", motivationStyle: "", accountabilityPreference: "",
    secondaryGoals: [], dietType: "", foodDislikes: "",
    coachingTone: "", mealsPerDay: "", proteinShakesPreference: "",
    cycleRegularity: "", cycleSymptoms: [],
    bodyFatPercentage: "", waist: "", hip: "", chest: "",
    arm: "", thigh: "", neck: "",
    hasProgressPhoto: false, progressPhotoUrl: null,
    progressPhotos: { front: null, back: null, left: null, right: null },
  };

  const hydration = calculateHydration(pseudo);

  const { data, error } = await supabase
    .from("user_baselines")
    .update({
      water_liters: hydration.waterLiters,
      sodium_mg: hydration.sodiumMg,
      magnesium_mg: hydration.magnesiumMg,
      potassium_mg: hydration.potassiumMg,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error recalculating hydration:", error);
    return null;
  }

  console.log("Hydration recalculated:", hydration);
  return data as unknown as UserBaseline;
};

/**
 * Update hydration-relevant profile fields and recalculate targets.
 * Call this when the user changes training type, duration, job type,
 * climate, or fat-loss phase toggle.
 */
export const updateHydrationInputs = async (fields: {
  primary_goal?: string;
  job_activity_level?: string;
  workout_types?: string[];
  training_days?: string;
  training_duration?: string;
  climate?: string;
  activity_level?: string;
  current_phase?: string;
  weight?: number;
}): Promise<UserBaseline | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Persist the changed fields
  const { data, error } = await supabase
    .from("user_baselines")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating hydration inputs:", error);
    throw error;
  }

  const updated = data as unknown as UserBaseline;

  // 2. Recalculate hydration from the now-updated baseline
  return recalculateHydrationFromBaseline(updated);
};
