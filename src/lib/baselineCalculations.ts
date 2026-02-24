import type { OnboardingData } from "@/components/OnboardingQuestionnaire";

// Types for calculation results
export interface HydrationWindow {
  /** Lower bound of the daily hydration window (30 ml/kg) — NEVER below this */
  lowerLiters: number;
  /** Upper bound of the daily hydration window (40 ml/kg) — NEVER above this */
  upperLiters: number;
  /** Guidance: true when high-intensity training >60 min (aim at upper bound) */
  isHighOutputDay: boolean;
  sodiumMg: number;
  magnesiumMg: number;
  potassiumMg: number;
  hasTraining: boolean;
  /** Guidance only: aim toward upper range */
  isHotClimate: boolean;
  /** Backward compat */
  restDayLiters: number;
  trainingDayLiters: number;
  /** @deprecated */
  waterLiters: number;
}

export interface BaselineResults {
  calories: {
    tdee: number;
    target: number;
    deficit: number;
  };
  macros: {
    protein: { grams: number; calories: number; percentage: number };
    carbs: { grams: number; calories: number; percentage: number };
    fats: { grams: number; calories: number; percentage: number };
  };
  hydration: HydrationWindow;
  mealPattern: MealTiming[];
  focusPoints: string[];
}

export interface MealTiming {
  meal: string;
  time: string;
  purpose: string;
}

// Activity multipliers based on spec
const ACTIVITY_MULTIPLIERS = {
  male: {
    not_active: 14,
    semi_active: 15,
    active: 16,
    very_active: 17,
  },
  female: {
    not_active: 13,
    semi_active: 14,
    active: 15,
    very_active: 16,
  },
};

// Job activity adjustments (added to base multiplier)
const JOB_ACTIVITY_ADJUSTMENTS: Record<string, number> = {
  sedentary: -0.5,
  light: 0,
  moderate: 0.5,
  active: 1.0,
};

// Workout type intensity factors (affects TDEE calculation)
const WORKOUT_TYPE_INTENSITY: Record<string, number> = {
  crossfit: 1.15,
  hiit: 1.12,
  weightlifting: 1.10,
  sports: 1.08,
  martial_arts: 1.08,
  swimming: 1.05,
  cycling: 1.05,
  cardio: 1.05,
  dance: 1.03,
  yoga: 1.00,
  walking: 1.00,
  none: 1.00,
};

// Goal adjustments
const GOAL_ADJUSTMENTS: Record<string, { min: number; max: number; default: number }> = {
  fat_loss: { min: -0.20, max: -0.10, default: -0.15 },
  muscle_gain: { min: 0.10, max: 0.15, default: 0.12 },
  performance: { min: 0, max: 0.05, default: 0.02 },
  recovery: { min: 0, max: 0.05, default: 0.02 },
  energy: { min: 0, max: 0.05, default: 0 },
  health_markers: { min: 0, max: 0, default: 0 },
  general_health: { min: 0, max: 0, default: 0 },
};

// Macro ratios by goal (protein g/kg, fat %, remaining carbs)
const MACRO_RATIOS: Record<string, { proteinPerKg: number; fatPercent: number }> = {
  fat_loss: { proteinPerKg: 2.2, fatPercent: 0.37 },
  muscle_gain: { proteinPerKg: 2.2, fatPercent: 0.35 },
  performance: { proteinPerKg: 2.0, fatPercent: 0.32 },
  recovery: { proteinPerKg: 2.0, fatPercent: 0.35 },
  energy: { proteinPerKg: 1.8, fatPercent: 0.40 }, // Higher fats for sustained energy
  health_markers: { proteinPerKg: 1.8, fatPercent: 0.39 },
  general_health: { proteinPerKg: 1.8, fatPercent: 0.39 },
};

// Unit conversions
const lbsToKg = (lbs: number): number => lbs / 2.205;
const kgToLbs = (kg: number): number => kg * 2.205;

// Convert feet/inches to cm
const heightToCm = (feet: number, inches: number): number => (feet * 30.48) + (inches * 2.54);

// Helper to get weight in both units from data
function getWeightFromData(data: OnboardingData): { weightLbs: number; weightKg: number } {
  const rawWeight = parseFloat(data.weight) || 150;
  if (data.unitSystem === "metric") {
    return { weightKg: rawWeight, weightLbs: kgToLbs(rawWeight) };
  }
  return { weightLbs: rawWeight, weightKg: lbsToKg(rawWeight) };
}

/**
 * Step 1: Calculate TDEE (Total Daily Energy Expenditure)
 * Now incorporates job activity level and workout types
 */
function calculateTDEE(data: OnboardingData): { tdee: number; target: number; deficit: number } {
  const { weightLbs } = getWeightFromData(data);
  const sex = data.sex || "male";
  const activityLevel = (data.activityLevel || "semi_active") as keyof typeof ACTIVITY_MULTIPLIERS.male;
  const goal = data.primaryGoal || "general_health";
  const jobActivity = data.jobActivityLevel || "light";
  const workoutTypes = data.workoutTypes || [];

  // Base multiplier from general activity level
  let multiplier = ACTIVITY_MULTIPLIERS[sex][activityLevel];
  
  // Adjust for job activity level
  const jobAdjustment = JOB_ACTIVITY_ADJUSTMENTS[jobActivity] || 0;
  multiplier += jobAdjustment;

  // Calculate workout intensity factor from workout types
  // Use the highest intensity workout if multiple selected, with diminishing returns for additional types
  let workoutIntensityFactor = 1.0;
  if (workoutTypes.length > 0 && !workoutTypes.includes("none")) {
    const intensities = workoutTypes
      .map(type => WORKOUT_TYPE_INTENSITY[type] || 1.0)
      .sort((a, b) => b - a);
    
    // Primary workout type gets full effect, each additional adds 20% of its bonus
    workoutIntensityFactor = intensities[0];
    for (let i = 1; i < Math.min(intensities.length, 3); i++) {
      workoutIntensityFactor += (intensities[i] - 1.0) * 0.2;
    }
  }

  // Base TDEE calculation
  let baseTdee = weightLbs * multiplier;
  
  // Apply workout intensity factor based on training frequency
  const trainingDays = data.trainingDays || "2-3";
  let trainingMultiplier = 1.0;
  if (trainingDays === "0-1") trainingMultiplier = 0.25;
  else if (trainingDays === "2-3") trainingMultiplier = 0.5;
  else if (trainingDays === "4-5") trainingMultiplier = 0.75;
  else if (trainingDays === "6+") trainingMultiplier = 1.0;
  
  // Apply scaled workout intensity
  const scaledIntensity = 1 + ((workoutIntensityFactor - 1) * trainingMultiplier);
  const tdee = Math.round(baseTdee * scaledIntensity);

  // Apply goal adjustment
  const adjustment = GOAL_ADJUSTMENTS[goal]?.default || 0;
  
  // Modifiers
  let modifiedAdjustment = adjustment;
  
  // Female luteal phase: +5% total kcal
  if (sex === "female" && data.currentPhase === "luteal") {
    modifiedAdjustment += 0.05;
  }

  const target = Math.round(tdee * (1 + modifiedAdjustment));
  const deficit = tdee - target;

  return { tdee, target, deficit };
}

/**
 * Step 2: Calculate Macro Distribution
 */
function calculateMacros(
  data: OnboardingData, 
  targetCalories: number
): BaselineResults["macros"] {
  const { weightKg } = getWeightFromData(data);
  const goal = data.primaryGoal || "general_health";
  const sex = data.sex || "male";

  let { proteinPerKg, fatPercent } = MACRO_RATIOS[goal] || MACRO_RATIOS.general_health;

  // Modifiers
  // Sleep <7 hrs: +5% protein
  if (data.sleepHours === "<5" || data.sleepHours === "5-6") {
    proteinPerKg *= 1.05;
  }

  // High stress: shift 5% from carbs to fats
  if (data.stressLevel === "high") {
    fatPercent += 0.05;
  }

  // Female luteal: +10-15% carbs (we'll reduce fat slightly to accommodate)
  if (sex === "female" && data.currentPhase === "luteal") {
    fatPercent -= 0.05;
  }

  // Calculate protein
  const proteinGrams = Math.round(weightKg * proteinPerKg);
  const proteinCalories = proteinGrams * 4;

  // Calculate fats
  const fatCalories = Math.round(targetCalories * fatPercent);
  const fatGrams = Math.round(fatCalories / 9);

  // Remaining calories go to carbs
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = Math.round(carbCalories / 4);

  return {
    protein: {
      grams: proteinGrams,
      calories: proteinCalories,
      percentage: Math.round((proteinCalories / targetCalories) * 100),
    },
    carbs: {
      grams: Math.max(0, carbGrams),
      calories: Math.max(0, carbCalories),
      percentage: Math.round((Math.max(0, carbCalories) / targetCalories) * 100),
    },
    fats: {
      grams: fatGrams,
      calories: fatCalories,
      percentage: Math.round((fatCalories / targetCalories) * 100),
    },
  };
}

/**
 * Step 3: Calculate Hydration & Electrolyte Baseline
 *
 * Master Hydration System — Lower-End Targets with Safeguards
 *
 * Safeguard 1: Climate defaults to "moderate" (no addition) if empty.
 * Safeguard 2: ONE base multiplier only (highest applicable, max 40).
 * Safeguard 3: Training fluid only on training days (not baked into baseline).
 * Safeguard 4: Climate addition only when explicitly "hot".
 * Safeguard 5: Missing data → conservative 35 ml/kg max default.
 * Safeguard 6: Recalculation triggered by weight/training/job/climate/phase changes.
 */
export function calculateHydration(data: OnboardingData): HydrationWindow {
  const { weightKg } = getWeightFromData(data);
  const trainingDays = data.trainingDays || "2-3";
  const workoutTypes = data.workoutTypes || [];
  const trainingDuration = data.trainingDuration || "30_60";
  const climate = data.climate || "moderate";
  const stressLevel = data.stressLevel || "moderate";
  const sleepHours = data.sleepHours || "7-8";

  // ── Fixed window: 30–40 ml/kg ──
  const lowerMl = weightKg * 30;
  const upperMl = weightKg * 40;

  const lowerLiters = Math.round((lowerMl / 1000) * 10) / 10;
  const upperLiters = Math.round((upperMl / 1000) * 10) / 10;

  // ── Guidance flags (do NOT change the window) ──
  const isHighIntensity = workoutTypes.some(t =>
    ["crossfit", "hiit", "martial_arts"].includes(t)
  );
  const isLongSession = ["60_90", "over_90"].includes(trainingDuration);
  const hasTraining = trainingDays !== "0-1" &&
    workoutTypes.length > 0 &&
    !workoutTypes.includes("none");
  const isHighOutputDay = hasTraining && isHighIntensity && isLongSession;
  const isHotClimate = climate === "hot";

  // ── Electrolytes (based on upper bound, not expanded) ──
  const needsElectrolyteFocus =
    upperMl > 3000 || isHighIntensity || trainingDays === "6+" || trainingDays === "4-5";

  let sodiumMg = needsElectrolyteFocus ? 3000 : 2500;
  let magnesiumMg = 350;
  const potassiumMg = 2750;

  if (stressLevel === "high" || sleepHours === "<5" || sleepHours === "5-6") {
    magnesiumMg += 75;
  }
  if (trainingDays === "6+" || isHotClimate) {
    sodiumMg += 500;
  }

  return {
    lowerLiters,
    upperLiters,
    isHighOutputDay,
    isHotClimate,
    hasTraining,
    sodiumMg: Math.round(sodiumMg),
    magnesiumMg: Math.round(magnesiumMg),
    potassiumMg: Math.round(potassiumMg),
    restDayLiters: lowerLiters,
    trainingDayLiters: upperLiters,
    waterLiters: lowerLiters,
  };
}

/**
 * Step 4: Generate Meal Pattern Recommendations
 */
function generateMealPattern(data: OnboardingData): MealTiming[] {
  const mealsPerDay = data.mealsPerDay || "3";
  const goal = data.primaryGoal || "general_health";
  const trainingDays = data.trainingDays || "2-3";
  
  const isActiveTrainer = trainingDays === "4-5" || trainingDays === "6+";

  if (mealsPerDay === "2") {
    return [
      { meal: "Meal 1", time: "11:00 AM", purpose: "Protein + balanced macros" },
      { meal: "Meal 2", time: "6:00 PM", purpose: "Protein + recovery focus" },
    ];
  }

  if (mealsPerDay === "4+" || mealsPerDay === "flexible") {
    const meals: MealTiming[] = [
      { meal: "Breakfast", time: "7:30 AM", purpose: "Protein + balanced carbs" },
      { meal: "Snack", time: "10:30 AM", purpose: "Protein + fiber for satiety" },
      { meal: "Lunch", time: "1:00 PM", purpose: goal === "performance" ? "Carb-dominant for energy" : "Balanced macros" },
      { meal: "Dinner", time: "7:00 PM", purpose: "Protein + fats for recovery" },
    ];

    if (isActiveTrainer) {
      meals.splice(3, 0, { meal: "Pre-Workout", time: "4:30 PM", purpose: "Quick carbs + lean protein" });
    }

    return meals;
  }

  // Default: 3 meals
  return [
    { meal: "Breakfast", time: "8:00 AM", purpose: "Protein + balanced carbs" },
    { meal: "Lunch", time: "12:30 PM", purpose: goal === "performance" ? "Carb-focused for energy" : "Balanced macros" },
    { meal: "Dinner", time: "7:00 PM", purpose: "Protein + fats for recovery" },
  ];
}

/**
 * Step 5: Generate Behavioral Focus Points
 * Based on onboarding data, identifies 1-3 key focus habits for the first week.
 * Each is presented as an educational anchor — "what to do" and why it matters.
 */
function generateFocusPoints(data: OnboardingData): string[] {
  const points: string[] = [];
  const goal = data.primaryGoal || "general_health";

  // Always include protein focus - core habit
  points.push("Focus on consistent protein at every meal to support recovery and satiety.");

  // Hydration focus - especially important for certain conditions
  if (data.sleepHours === "<5" || data.sleepHours === "5-6" || data.stressLevel === "high") {
    points.push("Prioritize hydration early — aim for 1L before lunch to support energy levels.");
  }

  // Goal-specific focus points
  if (goal === "fat_loss") {
    points.push("Aim for 90% of food intake from whole, minimally processed foods.");
    points.push("Keep added sugar intake under 10g per day for optimal results.");
  } else if (goal === "muscle_gain") {
    points.push("Add complex carbs around training to sustain performance and recovery.");
  } else if (goal === "performance") {
    points.push("Time your largest carb intake 2-3 hours before training sessions.");
  } else if (goal === "recovery") {
    points.push("Prioritize anti-inflammatory foods like fatty fish, berries, and leafy greens.");
  } else if (goal === "energy") {
    points.push("Distribute calories evenly throughout the day to maintain steady energy.");
  } else if (goal === "health_markers") {
    points.push("Focus on fiber-rich foods and limit processed options to support overall health markers.");
  }

  // Whole foods focus for all goals
  if (goal !== "fat_loss") {
    points.push("Aim for 90% of food intake from whole, minimally processed foods.");
  }

  // Sleep-based recommendations
  if (data.sleepHours === "<5" || data.sleepHours === "5-6") {
    points.push("Include magnesium-rich foods in your evening meal to support sleep quality.");
  }

  // Stress-based recommendations
  if (data.stressLevel === "high") {
    points.push("Focus on steady energy through balanced meals — avoid large gaps between eating.");
  }

  // Activity-based recommendations
  if (data.activityLevel === "not_active" || data.activityLevel === "semi_active") {
    points.push("Start with a 10-minute post-meal walk to support digestion and blood sugar.");
  }

  // Meal planning for busy lifestyles
  if (data.workHours === "10+") {
    points.push("Increase meal planning on workdays to reduce skipped meals.");
  }

  // Female cycle-based recommendations
  if (data.sex === "female" && data.currentPhase === "luteal") {
    points.push("Honor increased appetite this week — your body needs slightly more fuel.");
  }

  // Return top 3 focus points (unique, prioritized)
  const uniquePoints = [...new Set(points)];
  return uniquePoints.slice(0, 3);
}

/**
 * Single source-of-truth function for all nutrition targets.
 * Used at onboarding AND whenever profile fields change.
 */
export function calculateNutritionTargets(data: OnboardingData): BaselineResults {
  const calories = calculateTDEE(data);
  const macros = calculateMacros(data, calories.target);
  const hydration = calculateHydration(data);
  const mealPattern = generateMealPattern(data);
  const focusPoints = generateFocusPoints(data);

  return {
    calories,
    macros,
    hydration,
    mealPattern,
    focusPoints,
  };
}

/** @deprecated Use calculateNutritionTargets instead. Kept for backward compat. */
export const calculateBaseline = calculateNutritionTargets;

/**
 * Get a summary message for the user
 */
export function getBaselineSummary(data: OnboardingData, results: BaselineResults): string {
  const goalLabels: Record<string, string> = {
    fat_loss: "fat loss",
    muscle_gain: "muscle gain", 
    performance: "performance optimization",
    general_health: "general health",
  };

  const goal = goalLabels[data.primaryGoal] || "your goals";
  
  return `Your starting recommendation is around ${results.calories.target.toLocaleString()} kcal/day with a protein goal of ${results.macros.protein.grams}g. Focus this week on protein consistency, hydration, and ${data.sleepHours === "<5" || data.sleepHours === "5-6" ? "improving sleep quality" : "maintaining your routine"}. The app adapts daily — your goal is consistency, not perfection.`;
}
