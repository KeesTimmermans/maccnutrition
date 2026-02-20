import { UserBaseline } from "@/lib/userService";
import { supabase } from "@/integrations/supabase/client";

// ── Check-in input types ────────────────────────────────────

export type ProgressStatus = "on_track" | "slower_than_expected" | "faster_than_expected" | "no_change";
export type EnergyLevel = "good" | "low";
export type HungerLevel = "manageable" | "high";
export type ActionIntent = "keep_plan" | "increase_rate" | "reduce_fatigue" | "diet_break";

export interface CheckinInputs {
  progressStatus: ProgressStatus;
  energy: EnergyLevel;
  hunger: HungerLevel;
  actionIntent: ActionIntent;
  feedback?: string;
  /** Optional: adherence score 0–100 from the user or estimated */
  adherence?: number;
  /** Optional: weekly weight-loss rate as fraction of bodyweight (e.g. 0.008 = 0.8%) */
  weeklyLossRate?: number;
  /** Optional: weekly weight-gain rate as fraction of bodyweight */
  weeklyGainRate?: number;
}

export interface AdjustmentResult {
  newCalories: number;
  newProtein: number;
  newCarbs: number;
  newFats: number;
  deltaCalories: number;
  baselineCalories: number;
  reason: string;
}

// ── Safety helpers ──────────────────────────────────────────

/** Minimum protein: 1.6 g per kg bodyweight */
function getMinProteinGrams(weightKg: number | null): number {
  if (!weightKg || weightKg <= 0) return 80; // safe fallback
  return Math.round(weightKg * 1.6);
}

/** Minimum fat: 0.6 g per kg bodyweight */
function getMinFatGrams(weightKg: number | null): number {
  if (!weightKg || weightKg <= 0) return 40; // safe fallback
  return Math.round(weightKg * 0.6);
}

/** Calorie floor that can support minimum protein + fat + 50g carbs */
function getCalorieFloor(sex: string | null, weightKg: number | null): number {
  const minProtein = getMinProteinGrams(weightKg);
  const minFat = getMinFatGrams(weightKg);
  const minCarbs = 50; // absolute minimum carbs
  const macroFloor = minProtein * 4 + minFat * 9 + minCarbs * 4;

  // Also enforce absolute minimums
  const absoluteMin = sex === "female" ? 1200 : 1500;
  return Math.max(macroFloor, absoluteMin);
}

// ── Core adjustment logic ───────────────────────────────────

/**
 * Applies coaching-based adjustments RELATIVE to current targets.
 * Does NOT recompute from scratch — modifies existing calories/macros.
 *
 * === Safeguards ===
 *
 * Fat Loss:
 *   - -5% only if adherence ≥ 80% AND energy ≠ low AND hunger ≠ high
 *   - Otherwise cap at -3%
 *   - Max single cut: -200 kcal
 *   - Total deficit cannot exceed 25% below TDEE
 *   - Rate-of-progress guard: >1% BW/week loss → force increase; <0.25% → allow decrease
 *   - Calories NEVER increase unless faster/low-energy/high-hunger/diet-break
 *
 * Muscle Gain:
 *   - Cap surplus at 15% above TDEE
 *   - Max +300 kcal per adjustment
 *
 * Maintenance:
 *   - ±100 kcal max
 *
 * Macros:
 *   - Protein minimum: 1.6 g/kg BW
 *   - Fat minimum: 0.6 g/kg BW
 *   - Adjust carbs first, protect fats
 */
export function applyProgressAdjustment(
  currentTargets: { calories: number; protein: number; carbs: number; fats: number },
  profile: { primaryGoal: string | null; sex: string | null; weight: number | null; tdee: number | null },
  inputs: CheckinInputs
): AdjustmentResult {
  const { calories, protein, carbs, fats } = currentTargets;
  const goal = profile.primaryGoal || "general_health";
  const tdee = profile.tdee || calories;
  const weightKg = profile.weight;

  let delta = 0;
  let reason = "";

  const adherence = inputs.adherence ?? 100; // default to high if not provided
  const hasBiofeedbackStress = inputs.energy === "low" || inputs.hunger === "high";

  // ── Goal: Fat Loss ──────────────────────────────────────
  if (goal === "fat_loss") {

    // Rate-of-progress guard (overrides other logic when triggered)
    if (inputs.weeklyLossRate !== undefined && weightKg && weightKg > 0) {
      if (inputs.weeklyLossRate > 0.01) {
        // Losing >1% BW/week → dangerously fast, force increase
        const bump = Math.round(calories * 0.05);
        delta = bump;
        reason = "Losing weight too fast (>1% BW/week) — increasing calories to protect muscle and health.";
      } else if (inputs.weeklyLossRate < 0.0025 && inputs.actionIntent === "increase_rate") {
        // Losing <0.25% BW/week and wants to push → allow decrease
        const maxCutPct = (adherence >= 80 && !hasBiofeedbackStress) ? 0.05 : 0.03;
        const cut = Math.round(calories * maxCutPct);
        delta = -Math.min(cut, 200);
        reason = `Very slow progress (<0.25% BW/week) — moderate calorie reduction (${Math.round(maxCutPct * 100)}%).`;
      }
    }

    // Standard rules (only if rate guard didn't trigger)
    if (delta === 0) {
      if (inputs.actionIntent === "diet_break") {
        delta = tdee - calories;
        reason = "Diet break: calories set to maintenance (TDEE).";
      } else if (hasBiofeedbackStress) {
        const bump = Math.round(calories * 0.04);
        delta = bump;
        reason = inputs.energy === "low"
          ? "Low energy reported — small calorie increase to support recovery."
          : "High hunger reported — small calorie increase to improve adherence.";
      } else if (inputs.progressStatus === "faster_than_expected") {
        const bump = Math.round(calories * 0.04);
        delta = bump;
        reason = "Progressing faster than expected — slight calorie increase to sustain muscle.";
      } else if (inputs.progressStatus === "slower_than_expected" && inputs.actionIntent === "increase_rate") {
        // Adherence-gated cut: -5% only if adherence ≥ 80% and no biofeedback stress
        const maxCutPct = (adherence >= 80 && !hasBiofeedbackStress) ? 0.05 : 0.03;
        const cut = Math.round(calories * maxCutPct);
        delta = -Math.min(cut, 200);
        reason = adherence >= 80
          ? `Slower progress + good adherence — ${Math.round(maxCutPct * 100)}% calorie reduction.`
          : "Slower progress but adherence needs work — conservative 3% reduction. Focus on consistency first.";
      } else if (inputs.actionIntent === "reduce_fatigue") {
        const bump = Math.round(calories * 0.03);
        delta = bump;
        reason = "Fatigue reported — small calorie increase for recovery.";
      } else {
        reason = "On track — no calorie adjustment needed.";
      }
    }

    // Fat-loss ceiling: never exceed TDEE (unless diet break sets it exactly)
    if (inputs.actionIntent !== "diet_break") {
      const projected = calories + delta;
      if (projected > tdee) {
        delta = tdee - calories;
        reason += " (capped at maintenance TDEE)";
      }
    }

    // Fat-loss max-deficit guard: cannot go below 75% of TDEE
    const minDeficitCals = Math.round(tdee * 0.75);
    if (calories + delta < minDeficitCals) {
      delta = minDeficitCals - calories;
      reason += ` (clamped: deficit cannot exceed 25% below maintenance, floor ${minDeficitCals} kcal)`;
    }
  }

  // ── Goal: Muscle Gain ───────────────────────────────────
  else if (goal === "muscle_gain") {
    if (inputs.progressStatus === "slower_than_expected") {
      const bump = Math.round(calories * 0.04);
      delta = Math.min(bump, 300); // cap at +300 kcal
      reason = "Slower gains — increasing surplus slightly (max +300 kcal).";
    } else if (inputs.progressStatus === "faster_than_expected") {
      delta = -Math.round(calories * 0.03);
      reason = "Gaining too fast — slight surplus reduction to limit fat gain.";
    } else if (inputs.actionIntent === "reduce_fatigue") {
      const bump = Math.round(calories * 0.03);
      delta = Math.min(bump, 300);
      reason = "Fatigue reported — small calorie increase for recovery.";
    } else {
      reason = "On track — no calorie adjustment needed.";
    }

    // Muscle-gain surplus cap: never exceed 115% of TDEE
    const maxSurplusCals = Math.round(tdee * 1.15);
    if (calories + delta > maxSurplusCals) {
      delta = maxSurplusCals - calories;
      reason += ` (capped at 15% surplus above maintenance, ceiling ${maxSurplusCals} kcal)`;
    }
  }

  // ── Goal: Maintenance / other ───────────────────────────
  else {
    if (inputs.progressStatus === "slower_than_expected" || inputs.progressStatus === "faster_than_expected") {
      const sign = inputs.progressStatus === "slower_than_expected" ? 1 : -1;
      delta = sign * Math.min(100, Math.round(calories * 0.03));
      reason = `Minor adjustment (±100 kcal max) for maintenance stability.`;
    } else {
      reason = "On track — no calorie adjustment needed.";
    }
  }

  // ── Apply calorie floor ────────────────────────────────
  const floor = getCalorieFloor(profile.sex, weightKg);
  let newCalories = Math.round(calories + delta);
  if (newCalories < floor) {
    newCalories = floor;
    reason += ` (clamped to safety floor of ${floor} kcal)`;
  }

  // ── Macro redistribution with body-weight-based minimums ─
  const minProtein = getMinProteinGrams(weightKg);
  const minFat = getMinFatGrams(weightKg);

  // Protein: keep stable, bump for fat-loss deficit, enforce minimum
  let newProtein = protein;
  if (goal === "fat_loss" && delta < 0) {
    newProtein = Math.round(protein * 1.02);
  }
  newProtein = Math.max(newProtein, minProtein);

  // Fats: keep stable, enforce minimum
  let newFats = Math.max(fats, minFat);

  const proteinCals = newProtein * 4;
  const fatCals = newFats * 9;

  // Carbs: absorb the calorie change
  let newCarbs = Math.round((newCalories - proteinCals - fatCals) / 4);

  // If carbs too low, bump calories to support macro minimums
  if (newCarbs < 50) {
    newCarbs = 50;
    const requiredCals = proteinCals + fatCals + newCarbs * 4;
    if (requiredCals > newCalories) {
      newCalories = requiredCals;
      reason += ` (calories raised to ${newCalories} to support minimum macros)`;
    }
  }

  return {
    newCalories,
    newProtein,
    newCarbs: Math.max(0, newCarbs),
    newFats: Math.max(0, newFats),
    deltaCalories: newCalories - calories,
    baselineCalories: calories,
    reason,
  };
}

// ── Persistence ─────────────────────────────────────────────

export async function persistProgressAdjustment(
  adjustment: AdjustmentResult,
  inputs: CheckinInputs,
  coachResponse: string | null,
  coachingFocusPoints: { emoji: string; text: string; tip?: string }[] | null,
  baseline: UserBaseline,
  measurements?: Record<string, number | null>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // 1. Update user_baselines with new targets
  if (adjustment.deltaCalories !== 0) {
    await supabase
      .from("user_baselines")
      .update({
        target_calories: adjustment.newCalories,
        protein_grams: adjustment.newProtein,
        carbs_grams: adjustment.newCarbs,
        fats_grams: adjustment.newFats,
        last_progress_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("user_baselines")
      .update({ last_progress_update: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  // 2. Store snapshot in progress_updates
  const insertData = {
    user_id: user.id,
    satisfaction_choice: `${inputs.progressStatus}__${inputs.actionIntent}`,
    user_feedback: inputs.feedback || null,
    coach_response: coachResponse || null,
    coaching_focus_points: coachingFocusPoints ? JSON.parse(JSON.stringify(coachingFocusPoints)) : null,
    adjustments: {
      baselineCalories: adjustment.baselineCalories,
      deltaCalories: adjustment.deltaCalories,
      finalCalories: adjustment.newCalories,
      adjustmentReason: adjustment.reason,
      progressStatus: inputs.progressStatus,
      energy: inputs.energy,
      hunger: inputs.hunger,
      actionIntent: inputs.actionIntent,
      adherence: inputs.adherence,
      weeklyLossRate: inputs.weeklyLossRate,
      weeklyGainRate: inputs.weeklyGainRate,
    },
    target_calories: adjustment.newCalories,
    protein_grams: adjustment.newProtein,
    carbs_grams: adjustment.newCarbs,
    fats_grams: adjustment.newFats,
    weight: measurements?.weight ?? baseline.weight,
    body_fat_percentage: measurements?.bodyFatPercentage ?? baseline.body_fat_percentage,
    waist_cm: measurements?.waistCm ?? baseline.waist_cm,
    hip_cm: measurements?.hipCm ?? baseline.hip_cm,
    chest_cm: measurements?.chestCm ?? baseline.chest_cm,
    arm_cm: measurements?.armCm ?? baseline.arm_cm,
    thigh_cm: measurements?.thighCm ?? baseline.thigh_cm,
    neck_cm: measurements?.neckCm ?? baseline.neck_cm,
  };

  const { error } = await supabase.from("progress_updates").insert(insertData);
  if (error) {
    console.error("Error saving progress update:", error);
    throw error;
  }
}
