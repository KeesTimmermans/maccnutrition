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

// ── Safety floors ───────────────────────────────────────────

function getCalorieFloor(sex: string | null, weightKg: number | null): number {
  // Dynamic floor: ~22 kcal per kg of estimated lean mass
  // Rough lean-mass estimate: males ~80%, females ~75% of total weight
  if (weightKg && weightKg > 0) {
    const leanFactor = sex === "female" ? 0.75 : 0.80;
    const dynamicFloor = Math.round(weightKg * leanFactor * 22);
    // Never below absolute minimums
    const absoluteMin = sex === "female" ? 1200 : 1500;
    return Math.max(dynamicFloor, absoluteMin);
  }
  return sex === "female" ? 1200 : 1500;
}

// ── Core adjustment logic ───────────────────────────────────

/**
 * Applies coaching-based adjustments RELATIVE to current targets.
 * Does NOT recompute from scratch — modifies existing calories/macros.
 *
 * Rules:
 *  Fat Loss:
 *    slower + increase_rate → -3..5% (max -200)
 *    faster → +3..5%
 *    energy=low OR hunger=high → +3..5%
 *    diet_break → set to TDEE (maintenance)
 *    on_track → no change
 *    Calories NEVER increase unless faster/low-energy/high-hunger/diet-break
 *
 *  Muscle Gain:
 *    slower → +3..5%
 *    faster → -3%
 *    on_track → no change
 *
 *  Maintenance / other:
 *    ±100 kcal max
 *
 *  Macros: protein stays stable (slight bump for fat-loss deficit),
 *          adjust carbs first, protect fats.
 */
export function applyProgressAdjustment(
  currentTargets: { calories: number; protein: number; carbs: number; fats: number },
  profile: { primaryGoal: string | null; sex: string | null; weight: number | null; tdee: number | null },
  inputs: CheckinInputs
): AdjustmentResult {
  const { calories, protein, carbs, fats } = currentTargets;
  const goal = profile.primaryGoal || "general_health";
  const floor = getCalorieFloor(profile.sex, profile.weight);
  const tdee = profile.tdee || calories; // fallback if TDEE not stored

  let delta = 0;
  let reason = "";

  // ── Goal: Fat Loss ──────────────────────────────────────
  if (goal === "fat_loss") {
    if (inputs.actionIntent === "diet_break") {
      delta = tdee - calories;
      reason = "Diet break: calories set to maintenance (TDEE).";
    } else if (inputs.energy === "low" || inputs.hunger === "high") {
      // Biofeedback override — allow increase
      const bump = Math.round(calories * 0.04); // ~4%
      delta = bump;
      reason = inputs.energy === "low"
        ? "Low energy reported — small calorie increase to support recovery."
        : "High hunger reported — small calorie increase to improve adherence.";
    } else if (inputs.progressStatus === "faster_than_expected") {
      const bump = Math.round(calories * 0.04);
      delta = bump;
      reason = "Progressing faster than expected — slight calorie increase to sustain muscle.";
    } else if (inputs.progressStatus === "slower_than_expected" && inputs.actionIntent === "increase_rate") {
      const cut = Math.round(calories * 0.04);
      delta = -Math.min(cut, 200);
      reason = "Slower progress + wants to push harder — moderate calorie reduction.";
    } else if (inputs.actionIntent === "reduce_fatigue") {
      const bump = Math.round(calories * 0.03);
      delta = bump;
      reason = "Fatigue reported — small calorie increase for recovery.";
    } else {
      reason = "On track — no calorie adjustment needed.";
    }
  }
  // ── Goal: Muscle Gain ───────────────────────────────────
  else if (goal === "muscle_gain") {
    if (inputs.progressStatus === "slower_than_expected") {
      delta = Math.round(calories * 0.04);
      reason = "Slower gains — increasing surplus slightly.";
    } else if (inputs.progressStatus === "faster_than_expected") {
      delta = -Math.round(calories * 0.03);
      reason = "Gaining too fast — slight surplus reduction to limit fat gain.";
    } else if (inputs.actionIntent === "reduce_fatigue") {
      delta = Math.round(calories * 0.03);
      reason = "Fatigue reported — small calorie increase for recovery.";
    } else {
      reason = "On track — no calorie adjustment needed.";
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

  // ── Apply floor ─────────────────────────────────────────
  let newCalories = Math.round(calories + delta);
  if (newCalories < floor) {
    newCalories = floor;
    reason += ` (clamped to safety floor of ${floor} kcal)`;
  }

  // ── Macro redistribution ────────────────────────────────
  // Protein: keep stable. If fat-loss deficit deepening, bump protein ~2%
  let newProtein = protein;
  if (goal === "fat_loss" && delta < 0) {
    newProtein = Math.round(protein * 1.02);
  }
  const proteinCals = newProtein * 4;

  // Fats: keep stable unless we absolutely must cut
  let newFats = fats;
  const fatCals = newFats * 9;

  // Carbs: absorb the calorie change
  const remainingCals = newCalories - proteinCals - fatCals;
  let newCarbs = Math.round(remainingCals / 4);

  // If carbs go negative, reduce fats proportionally (last resort)
  if (newCarbs < 50) {
    const neededFromFats = (50 - newCarbs) * 4; // extra cals needed for minimum carbs
    newFats = Math.max(Math.round((fatCals - neededFromFats) / 9), 30);
    newCarbs = Math.round((newCalories - newProtein * 4 - newFats * 9) / 4);
    newCarbs = Math.max(newCarbs, 50);
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
    // Even if no adjustment, mark the check-in timestamp
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
    },
    // Snapshot of NEW targets
    target_calories: adjustment.newCalories,
    protein_grams: adjustment.newProtein,
    carbs_grams: adjustment.newCarbs,
    fats_grams: adjustment.newFats,
    // Measurement snapshot
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
