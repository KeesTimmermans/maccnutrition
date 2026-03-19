/**
 * Builds a structured Competition Prep context object for Coach Mac.
 * This is consumed by the AI coach edge function to personalize advice.
 */
import { supabase } from "@/integrations/supabase/client";
import { calculateCompetitionPrep, type CompPrepCalcInput } from "./engine";
import { EVENT_LABELS, DIVISION_LABELS } from "./eventProfiles";
import type { EventType, CompGoal, PrepPhase, NutritionMode, CompetitionPrepResult } from "./types";

export interface CompPrepCoachContext {
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
  calorieTarget: number;
  trainingDayCalories: number;
  restDayCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  weightLossRatePct: number | null;
  projectedEventWeight: { low: number; high: number } | null;
  goalWeightRealistic: boolean;
  goalWeightWarning: string | null;
  priorities: string[];
  explanation: string;
  taperGuidance: string[] | null;
  hydrationNotes: string[] | null;
  recentCheckin: {
    weekNumber: number;
    avgWeight: number | null;
    adherencePct: number | null;
    hungerLevel: number | null;
    energyLevel: number | null;
    recoveryLevel: number | null;
    performanceTrend: string | null;
    adjustmentsApplied: string | null;
    createdAt: string;
  } | null;
}

/**
 * Fetch active competition prep and build a context object for Coach Mac.
 * Returns null if no active prep exists.
 */
export async function buildCompPrepCoachContext(
  weightKg: number | null,
  tdee: number | null,
): Promise<CompPrepCoachContext | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: prep } = await supabase
    .from("competition_preps")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!prep) return null;

  // Calculate live result from engine
  const w = weightKg ?? 75;
  const t = tdee ?? 2200;
  let result: CompetitionPrepResult;
  try {
    result = calculateCompetitionPrep({
      eventType: prep.event_type as EventType,
      eventDate: prep.event_date,
      primaryGoal: prep.primary_goal as CompGoal,
      goalWeight: prep.goal_weight ?? undefined,
      weightKg: w,
      tdee: t,
    });
  } catch {
    return null;
  }

  // Fetch most recent check-in
  const { data: checkins } = await supabase
    .from("competition_checkins")
    .select("*")
    .eq("prep_id", prep.id)
    .order("week_number", { ascending: false })
    .limit(1);

  const lastCheckin = checkins?.[0] ?? null;

  const eventType = prep.event_type as EventType;

  return {
    eventType: prep.event_type,
    eventLabel: EVENT_LABELS[eventType] || prep.event_type,
    eventDate: prep.event_date,
    division: prep.division,
    divisionLabel: DIVISION_LABELS[prep.division] || prep.division,
    primaryGoal: prep.primary_goal,
    weeksOut: result.weeksOut,
    daysOut: result.daysOut,
    currentPhase: result.phase,
    phaseLabel: result.phaseLabel,
    currentMode: result.mode,
    modeLabel: result.modeLabel,
    calorieTarget: result.calories,
    trainingDayCalories: result.trainingDayCalories,
    restDayCalories: result.restDayCalories,
    proteinGrams: result.protein,
    carbGrams: result.carbs,
    fatGrams: result.fats,
    weightLossRatePct: result.weightLossRatePct,
    projectedEventWeight: result.projectedEventWeight,
    goalWeightRealistic: result.goalWeightRealistic,
    goalWeightWarning: result.goalWeightWarning,
    priorities: result.priorities,
    explanation: result.explanation,
    taperGuidance: result.taperGuidance,
    hydrationNotes: result.hydrationNotes,
    recentCheckin: lastCheckin ? {
      weekNumber: lastCheckin.week_number,
      avgWeight: lastCheckin.avg_weight,
      adherencePct: lastCheckin.adherence_pct,
      hungerLevel: lastCheckin.hunger_level,
      energyLevel: lastCheckin.energy_level,
      recoveryLevel: lastCheckin.recovery_level,
      performanceTrend: lastCheckin.performance_trend,
      adjustmentsApplied: lastCheckin.adjustments_applied
        ? (typeof lastCheckin.adjustments_applied === 'object' && (lastCheckin.adjustments_applied as any).reason)
          ? (lastCheckin.adjustments_applied as any).reason
          : JSON.stringify(lastCheckin.adjustments_applied)
        : null,
      createdAt: lastCheckin.created_at,
    } : null,
  };
}
