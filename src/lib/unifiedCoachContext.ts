/**
 * Unified Coaching Context
 *
 * Single source of truth for all Coach Mac surfaces.
 * Every Coach Mac card, greeting, chat prompt, and coaching block
 * MUST read from this context — never from baseline directly
 * when active targets exist.
 */

import type { ActiveNutritionTargets, TargetSource } from "@/hooks/useActiveNutritionTargets";
import type { UserBaseline } from "@/lib/userService";
import type { DailyCheckIn, CheckInAnalysis } from "@/lib/checkinService";
import type { MealPatternAnalysis } from "@/lib/coachingAnalytics";
import type { CoachingFocusPoint } from "@/lib/progressUpdateService";
import type { CompPrepCoachContext } from "@/lib/competitionPrep/coachContext";

// ── A. Active Nutrition Layer ──────────────────────────────────
export interface NutritionLayer {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  waterLiters: number;
  waterLitersTraining: number | null;
  priorities: string[];
  source: TargetSource;
}

// ── B. Competition Prep Context ────────────────────────────────
export interface CompPrepLayer {
  eventType: string;
  eventLabel: string;
  eventDate: string;
  division: string;
  divisionLabel: string;
  primaryGoal: string;
  weeksOut: number;
  daysOut: number;
  currentPhase: string;
  phaseLabel: string;
  currentMode: string;
  modeLabel: string;
  trainingDayCalories: number;
  restDayCalories: number;
  weightLossRatePct: number | null;
  projectedEventWeight: { low: number; high: number } | null;
  goalWeightRealistic: boolean;
  goalWeightWarning: string | null;
  priorities: string[];
  explanation: string;
  taperGuidance: string[] | null;
  hydrationNotes: string[] | null;
  recentCheckin: CompPrepCoachContext["recentCheckin"] | null;
  isTaperOrRaceWeek: boolean;
}

// ── C. Daily Progress ──────────────────────────────────────────
export interface DailyProgressLayer {
  caloriesLogged: number;
  proteinLogged: number;
  carbsLogged: number;
  fatsLogged: number;
  waterLoggedMl: number;
  mealsLogged: number;
  calPercent: number;
  proteinPercent: number;
  waterPercent: number;
}

// ── D. Wellness / Recovery ─────────────────────────────────────
export interface WellnessLayer {
  mood: number | null;
  energy: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  stress: number | null;
  hungerLevel: number | null;
  hasCheckedInToday: boolean;
}

// ── E. Profile / Goal Context ──────────────────────────────────
export interface ProfileLayer {
  name: string | null;
  firstName: string;
  primaryGoal: string | null;
  secondaryGoals: string[] | null;
  sex: string | null;
  age: number | null;
  activityLevel: string | null;
  trainingDays: string | null;
  trainingIntensity: string | null;
  dietType: string | null;
  foodDislikes: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  coachingTone: string | null;
  mealsPerDay: string | null;
  mealPrepTime: string | null;
  cookingSkill: string | null;
  proteinShakesPreference: string | null;
  eatingSpeed: string | null;
  hungerPatterns: string | null;
  cravingsTriggers: string[] | null;
  emotionalEating: string | null;
  snackingHabits: string | null;
  hydrationHabits: string | null;
  energyPatterns: string | null;
  biggestChallenge: string | null;
  pastDiets: string[] | null;
  weekendHabits: string | null;
  eatingOutFrequency: string | null;
  motivationStyle: string | null;
  accountabilityPreference: string | null;
  currentPhase: string | null;
  cycleRegularity: string | null;
  cycleSymptoms: string[] | null;
  sleepHoursTarget: string | null;
  occupation: string | null;
  focusPoints: string[] | null;
  lastProgressUpdate: string | null;
  accountAgeDays: number;
}

// ── Full Unified Context ───────────────────────────────────────
export interface UnifiedCoachContext {
  nutrition: NutritionLayer;
  compPrep: CompPrepLayer | null;
  progress: DailyProgressLayer;
  wellness: WellnessLayer;
  profile: ProfileLayer;
  /** Current hour (0-23) */
  currentHour: number;
  isWeekend: boolean;
  dayOfWeek: string;
}

// ── Builder ────────────────────────────────────────────────────

export interface BuildUnifiedContextInput {
  activeTargets: ActiveNutritionTargets;
  baseline: UserBaseline | null;
  compPrepContext: CompPrepCoachContext | null;
  todaysMeals: { calories: number; protein: number; carbs: number; fats: number }[];
  waterIntakeMl: number;
  todaysCheckIn: DailyCheckIn | null;
  accountAgeDays?: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildUnifiedCoachContext(input: BuildUnifiedContextInput): UnifiedCoachContext {
  const { activeTargets, baseline, compPrepContext, todaysMeals, waterIntakeMl, todaysCheckIn, accountAgeDays = 0 } = input;

  // A. Nutrition layer — always from activeTargets
  const nutrition: NutritionLayer = {
    calories: activeTargets.calories,
    protein: activeTargets.protein,
    carbs: activeTargets.carbs,
    fats: activeTargets.fats,
    sugar: activeTargets.sugar,
    waterLiters: activeTargets.waterLiters,
    waterLitersTraining: activeTargets.waterLitersTraining,
    priorities: activeTargets.priorities,
    source: activeTargets.source,
  };

  // B. Comp prep layer
  let compPrep: CompPrepLayer | null = null;
  if (compPrepContext && activeTargets.source === 'competition_prep') {
    const taperPhases = ['taper', 'race_week'];
    compPrep = {
      eventType: compPrepContext.eventType,
      eventLabel: compPrepContext.eventLabel,
      eventDate: compPrepContext.eventDate,
      division: compPrepContext.division,
      divisionLabel: compPrepContext.divisionLabel,
      primaryGoal: compPrepContext.primaryGoal,
      weeksOut: compPrepContext.weeksOut,
      daysOut: compPrepContext.daysOut,
      currentPhase: compPrepContext.currentPhase,
      phaseLabel: compPrepContext.phaseLabel,
      currentMode: compPrepContext.currentMode,
      modeLabel: compPrepContext.modeLabel,
      trainingDayCalories: activeTargets.compPrepMeta?.trainingDayCalories ?? compPrepContext.trainingDayCalories,
      restDayCalories: activeTargets.compPrepMeta?.restDayCalories ?? compPrepContext.restDayCalories,
      weightLossRatePct: compPrepContext.weightLossRatePct,
      projectedEventWeight: compPrepContext.projectedEventWeight,
      goalWeightRealistic: compPrepContext.goalWeightRealistic,
      goalWeightWarning: compPrepContext.goalWeightWarning,
      priorities: compPrepContext.priorities,
      explanation: compPrepContext.explanation,
      taperGuidance: compPrepContext.taperGuidance,
      hydrationNotes: compPrepContext.hydrationNotes,
      recentCheckin: compPrepContext.recentCheckin,
      isTaperOrRaceWeek: taperPhases.includes(compPrepContext.currentPhase),
    };
  }

  // C. Daily progress
  const totalCalories = todaysMeals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = todaysMeals.reduce((s, m) => s + m.protein, 0);
  const totalCarbs = todaysMeals.reduce((s, m) => s + m.carbs, 0);
  const totalFats = todaysMeals.reduce((s, m) => s + m.fats, 0);
  const waterGoal = nutrition.waterLiters * 1000;

  const progress: DailyProgressLayer = {
    caloriesLogged: totalCalories,
    proteinLogged: totalProtein,
    carbsLogged: totalCarbs,
    fatsLogged: totalFats,
    waterLoggedMl: waterIntakeMl,
    mealsLogged: todaysMeals.length,
    calPercent: nutrition.calories > 0 ? Math.round((totalCalories / nutrition.calories) * 100) : 0,
    proteinPercent: nutrition.protein > 0 ? Math.round((totalProtein / nutrition.protein) * 100) : 0,
    waterPercent: waterGoal > 0 ? Math.round((waterIntakeMl / waterGoal) * 100) : 0,
  };

  // D. Wellness
  const wellness: WellnessLayer = {
    mood: todaysCheckIn?.mood ?? null,
    energy: todaysCheckIn?.energy_level ?? null,
    sleepQuality: todaysCheckIn?.sleep_quality ?? null,
    sleepHours: todaysCheckIn?.sleep_hours ?? null,
    stress: todaysCheckIn?.stress_level ?? null,
    hungerLevel: todaysCheckIn?.hunger_level ?? null,
    hasCheckedInToday: !!todaysCheckIn,
  };

  // E. Profile
  const profile: ProfileLayer = {
    name: baseline?.name ?? null,
    firstName: baseline?.name?.split(' ')[0] || '',
    primaryGoal: baseline?.primary_goal ?? null,
    secondaryGoals: baseline?.secondary_goals ?? null,
    sex: baseline?.sex ?? null,
    age: baseline?.age ?? null,
    activityLevel: baseline?.activity_level ?? null,
    trainingDays: baseline?.training_days ?? null,
    trainingIntensity: baseline?.training_intensity ?? null,
    dietType: baseline?.diet_type ?? null,
    foodDislikes: baseline?.food_dislikes ?? null,
    allergies: baseline?.allergies ?? null,
    conditions: baseline?.conditions ?? null,
    coachingTone: baseline?.coaching_tone ?? null,
    mealsPerDay: baseline?.meals_per_day ?? null,
    mealPrepTime: baseline?.meal_prep_time ?? null,
    cookingSkill: baseline?.cooking_skill ?? null,
    proteinShakesPreference: baseline?.protein_shakes_preference ?? null,
    eatingSpeed: baseline?.eating_speed ?? null,
    hungerPatterns: baseline?.hunger_patterns ?? null,
    cravingsTriggers: baseline?.cravings_triggers ?? null,
    emotionalEating: baseline?.emotional_eating ?? null,
    snackingHabits: baseline?.snacking_habits ?? null,
    hydrationHabits: baseline?.hydration_habits ?? null,
    energyPatterns: baseline?.energy_patterns ?? null,
    biggestChallenge: baseline?.biggest_challenge ?? null,
    pastDiets: baseline?.past_diets ?? null,
    weekendHabits: baseline?.weekend_habits ?? null,
    eatingOutFrequency: baseline?.eating_out_frequency ?? null,
    motivationStyle: baseline?.motivation_style ?? null,
    accountabilityPreference: baseline?.accountability_preference ?? null,
    currentPhase: baseline?.current_phase ?? null,
    cycleRegularity: baseline?.cycle_regularity ?? null,
    cycleSymptoms: baseline?.cycle_symptoms ?? null,
    sleepHoursTarget: baseline?.sleep_hours ?? null,
    occupation: baseline?.occupation ?? null,
    focusPoints: baseline?.focus_points ?? null,
    lastProgressUpdate: baseline?.last_progress_update ?? null,
    accountAgeDays,
  };

  const now = new Date();

  return {
    nutrition,
    compPrep,
    progress,
    wellness,
    profile,
    currentHour: now.getHours(),
    isWeekend: [0, 6].includes(now.getDay()),
    dayOfWeek: DAYS[now.getDay()],
  };
}

/**
 * Build the userContext payload for the ai-coach edge function
 * from the unified context. This replaces all scattered baseline reads.
 */
export function buildEdgeFunctionUserContext(
  ctx: UnifiedCoachContext,
  extra: {
    checkInContext?: string;
    checkInAnalysis?: CheckInAnalysis | null;
    cyclePhaseTodayCheckin?: string;
    preferredLanguage?: string;
    lastDailyCheckin?: string;
    wearableContext?: string;
  } = {}
): Record<string, unknown> {
  return {
    userName: ctx.profile.name,
    primaryGoal: ctx.profile.primaryGoal,
    secondaryGoals: ctx.profile.secondaryGoals,
    sex: ctx.profile.sex,
    age: ctx.profile.age,
    // Always from unified nutrition layer (activeTargets)
    targetCalories: ctx.nutrition.calories,
    proteinGrams: ctx.nutrition.protein,
    carbsGrams: ctx.nutrition.carbs,
    fatsGrams: ctx.nutrition.fats,
    waterLiters: ctx.nutrition.waterLiters,
    targetSource: ctx.nutrition.source,
    // Profile metadata
    activityLevel: ctx.profile.activityLevel,
    trainingDays: ctx.profile.trainingDays,
    trainingIntensity: ctx.profile.trainingIntensity,
    sleepHours: ctx.profile.sleepHoursTarget,
    stressLevel: null, // baseline doesn't store numeric stress
    occupation: ctx.profile.occupation,
    eatingSpeed: ctx.profile.eatingSpeed,
    hungerPatterns: ctx.profile.hungerPatterns,
    cravingsTriggers: ctx.profile.cravingsTriggers,
    emotionalEating: ctx.profile.emotionalEating,
    snackingHabits: ctx.profile.snackingHabits,
    hydrationHabits: ctx.profile.hydrationHabits,
    energyPatterns: ctx.profile.energyPatterns,
    biggestChallenge: ctx.profile.biggestChallenge,
    pastDiets: ctx.profile.pastDiets,
    weekendHabits: ctx.profile.weekendHabits,
    eatingOutFrequency: ctx.profile.eatingOutFrequency,
    motivationStyle: ctx.profile.motivationStyle,
    accountabilityPreference: ctx.profile.accountabilityPreference,
    dietType: ctx.profile.dietType,
    foodDislikes: ctx.profile.foodDislikes,
    allergies: ctx.profile.allergies,
    conditions: ctx.profile.conditions,
    coachingTone: ctx.profile.coachingTone,
    focusPoints: ctx.nutrition.priorities.length > 0 ? ctx.nutrition.priorities : (ctx.profile.focusPoints || []),
    mealsPerDay: ctx.profile.mealsPerDay,
    mealPrepTime: ctx.profile.mealPrepTime,
    cookingSkill: ctx.profile.cookingSkill,
    proteinShakesPreference: ctx.profile.proteinShakesPreference,
    currentPhase: ctx.profile.currentPhase,
    cycleRegularity: ctx.profile.cycleRegularity,
    cycleSymptoms: ctx.profile.cycleSymptoms,
    cyclePhaseTodayCheckin: extra.cyclePhaseTodayCheckin || undefined,
    checkInContext: extra.checkInContext || undefined,
    checkInAnalysis: extra.checkInAnalysis || undefined,
    preferredLanguage: extra.preferredLanguage || 'en',
    lastProgressUpdate: ctx.profile.lastProgressUpdate || undefined,
    lastDailyCheckin: extra.lastDailyCheckin || undefined,
    wearableContext: extra.wearableContext || undefined,
    // Competition prep context — macros already guaranteed to match activeTargets
    competitionPrepContext: ctx.compPrep ? {
      eventType: ctx.compPrep.eventType,
      eventLabel: ctx.compPrep.eventLabel,
      eventDate: ctx.compPrep.eventDate,
      division: ctx.compPrep.division,
      divisionLabel: ctx.compPrep.divisionLabel,
      primaryGoal: ctx.compPrep.primaryGoal,
      weeksOut: ctx.compPrep.weeksOut,
      daysOut: ctx.compPrep.daysOut,
      currentPhase: ctx.compPrep.currentPhase,
      phaseLabel: ctx.compPrep.phaseLabel,
      currentMode: ctx.compPrep.currentMode,
      modeLabel: ctx.compPrep.modeLabel,
      calorieTarget: ctx.nutrition.calories, // always from nutrition layer
      trainingDayCalories: ctx.compPrep.trainingDayCalories,
      restDayCalories: ctx.compPrep.restDayCalories,
      proteinGrams: ctx.nutrition.protein,
      carbGrams: ctx.nutrition.carbs,
      fatGrams: ctx.nutrition.fats,
      weightLossRatePct: ctx.compPrep.weightLossRatePct,
      projectedEventWeight: ctx.compPrep.projectedEventWeight,
      goalWeightRealistic: ctx.compPrep.goalWeightRealistic,
      goalWeightWarning: ctx.compPrep.goalWeightWarning,
      priorities: ctx.compPrep.priorities,
      explanation: ctx.compPrep.explanation,
      taperGuidance: ctx.compPrep.taperGuidance,
      hydrationNotes: ctx.compPrep.hydrationNotes,
      recentCheckin: ctx.compPrep.recentCheckin,
    } : undefined,
  };
}
