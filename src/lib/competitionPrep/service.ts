/**
 * Service layer for competition prep CRUD and recalculation
 */
import { supabase } from "@/integrations/supabase/client";
import type { CompetitionPrepInput, CompetitionPrepResult, WeeklyCheckinInput } from "./types";
import { calculateCompetitionPrep, calculateWeeklyAdjustment, CompPrepCalcInput } from "./engine";

export interface StoredCompPrep {
  id: string;
  user_id: string;
  event_type: string;
  event_date: string;
  division: string;
  primary_goal: string;
  goal_weight: number | null;
  is_active: boolean;
  current_phase: string | null;
  current_mode: string | null;
  calorie_target: number | null;
  protein_grams: number | null;
  carb_grams: number | null;
  fat_grams: number | null;
  training_day_calories: number | null;
  rest_day_calories: number | null;
  weight_loss_rate_pct: number | null;
  phase_explanation: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredCheckin {
  id: string;
  user_id: string;
  prep_id: string;
  week_number: number;
  avg_weight: number | null;
  adherence_pct: number | null;
  hunger_level: number | null;
  energy_level: number | null;
  recovery_level: number | null;
  performance_trend: string | null;
  cycle_phase: string | null;
  notes: string | null;
  adjustments_applied: any | null;
  created_at: string;
}

/** Get the active competition prep for current user */
export async function getActiveCompPrep(): Promise<StoredCompPrep | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("competition_preps")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as StoredCompPrep | null;
}

/** Create a new competition prep, deactivating any existing active ones */
export async function createCompPrep(
  input: CompetitionPrepInput,
  weightKg: number,
  tdee: number,
): Promise<{ prep: StoredCompPrep; result: CompetitionPrepResult }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Deactivate existing active preps
  await supabase
    .from("competition_preps")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  // Calculate
  const calcInput: CompPrepCalcInput = {
    eventType: input.eventType,
    eventDate: input.eventDate,
    primaryGoal: input.primaryGoal,
    goalWeight: input.goalWeight,
    weightKg,
    tdee,
  };
  const result = calculateCompetitionPrep(calcInput);

  // Insert
  const { data, error } = await supabase
    .from("competition_preps")
    .insert({
      user_id: user.id,
      event_type: input.eventType,
      event_date: input.eventDate,
      division: input.division === "custom" ? (input.customDivision || "custom") : input.division,
      primary_goal: input.primaryGoal,
      goal_weight: input.goalWeight || null,
      is_active: true,
      current_phase: result.phase,
      current_mode: result.mode,
      calorie_target: result.calories,
      protein_grams: result.protein,
      carb_grams: result.carbs,
      fat_grams: result.fats,
      training_day_calories: result.trainingDayCalories,
      rest_day_calories: result.restDayCalories,
      weight_loss_rate_pct: result.weightLossRatePct,
      phase_explanation: result.explanation,
    })
    .select()
    .single();

  if (error) throw error;
  return { prep: data as StoredCompPrep, result };
}

/** Recalculate an existing prep (e.g. when time passes or user changes settings) */
export async function recalculateCompPrep(
  prepId: string,
  weightKg: number,
  tdee: number,
): Promise<CompetitionPrepResult> {
  const { data: prep, error: fetchError } = await supabase
    .from("competition_preps")
    .select("*")
    .eq("id", prepId)
    .single();

  if (fetchError || !prep) throw new Error("Prep not found");

  const result = calculateCompetitionPrep({
    eventType: prep.event_type as any,
    eventDate: prep.event_date,
    primaryGoal: prep.primary_goal as any,
    goalWeight: prep.goal_weight ?? undefined,
    weightKg,
    tdee,
  });

  await supabase
    .from("competition_preps")
    .update({
      current_phase: result.phase,
      current_mode: result.mode,
      calorie_target: result.calories,
      protein_grams: result.protein,
      carb_grams: result.carbs,
      fat_grams: result.fats,
      training_day_calories: result.trainingDayCalories,
      rest_day_calories: result.restDayCalories,
      weight_loss_rate_pct: result.weightLossRatePct,
      phase_explanation: result.explanation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prepId);

  return result;
}

/** Submit a weekly check-in and get adjustments */
export async function submitCheckin(
  prepId: string,
  checkinInput: WeeklyCheckinInput,
  weekNumber: number,
  weightKg: number,
  tdee: number,
): Promise<{ result: CompetitionPrepResult; adjustment: any }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get current result
  const result = await recalculateCompPrep(prepId, weightKg, tdee);

  // Get previous check-in
  const { data: prevCheckins } = await supabase
    .from("competition_checkins")
    .select("*")
    .eq("prep_id", prepId)
    .order("week_number", { ascending: false })
    .limit(1);

  const prevCheckin: WeeklyCheckinInput | null = prevCheckins?.[0] ? {
    avgWeight: prevCheckins[0].avg_weight ?? 0,
    adherencePct: prevCheckins[0].adherence_pct ?? 80,
    hungerLevel: prevCheckins[0].hunger_level ?? 3,
    energyLevel: prevCheckins[0].energy_level ?? 3,
    recoveryLevel: prevCheckins[0].recovery_level ?? 3,
    performanceTrend: (prevCheckins[0].performance_trend as any) ?? "stable",
    cyclePhase: prevCheckins[0].cycle_phase ?? undefined,
  } : null;

  const adjustment = calculateWeeklyAdjustment(checkinInput, prevCheckin, result, weightKg);

  // Save check-in
  await supabase
    .from("competition_checkins")
    .insert({
      user_id: user.id,
      prep_id: prepId,
      week_number: weekNumber,
      avg_weight: checkinInput.avgWeight,
      adherence_pct: checkinInput.adherencePct,
      hunger_level: checkinInput.hungerLevel,
      energy_level: checkinInput.energyLevel,
      recovery_level: checkinInput.recoveryLevel,
      performance_trend: checkinInput.performanceTrend,
      cycle_phase: checkinInput.cyclePhase || null,
      adjustments_applied: adjustment,
    });

  // Apply adjustments to the prep
  if (adjustment.calorieChange !== 0) {
    const newCals = result.calories + adjustment.calorieChange;
    const newCarbs = result.carbs + adjustment.carbChange;
    const newFats = result.fats + adjustment.fatChange;

    await supabase
      .from("competition_preps")
      .update({
        calorie_target: newCals,
        carb_grams: newCarbs,
        fat_grams: newFats,
        phase_explanation: adjustment.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prepId);
  }

  return { result, adjustment };
}

/** Get all check-ins for a prep */
export async function getCheckins(prepId: string): Promise<StoredCheckin[]> {
  const { data } = await supabase
    .from("competition_checkins")
    .select("*")
    .eq("prep_id", prepId)
    .order("week_number", { ascending: true });

  return (data ?? []) as StoredCheckin[];
}

/** Deactivate a competition prep */
export async function deactivateCompPrep(prepId: string): Promise<void> {
  await supabase
    .from("competition_preps")
    .update({ is_active: false })
    .eq("id", prepId);
}
