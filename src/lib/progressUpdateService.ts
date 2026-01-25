import { supabase } from "@/integrations/supabase/client";
import { UserBaseline } from "@/lib/userService";

export interface ProgressUpdate {
  id: string;
  user_id: string;
  created_at: string;
  satisfaction_choice: string;
  user_feedback: string | null;
  coach_response: string | null;
  adjustments: {
    calorieChange?: number;
    proteinChange?: number;
    reason?: string;
  } | null;
  target_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fats_grams: number | null;
  weight: number | null;
  body_fat_percentage: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
}

export interface SaveProgressUpdateParams {
  satisfactionChoice: "happy" | "more_progress" | "update_measurements";
  userFeedback?: string;
  coachResponse?: string;
  adjustments?: {
    calorieChange: number;
    proteinChange: number;
    reason: string;
  };
  baseline: UserBaseline;
  measurements?: {
    weight?: number | null;
    bodyFatPercentage?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    chestCm?: number | null;
    armCm?: number | null;
    thighCm?: number | null;
    neckCm?: number | null;
  };
}

/**
 * Save a progress update to the database
 */
export const saveProgressUpdate = async (params: SaveProgressUpdateParams): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { satisfactionChoice, userFeedback, coachResponse, adjustments, baseline, measurements } = params;

  const { error } = await supabase.from("progress_updates").insert({
    user_id: user.id,
    satisfaction_choice: satisfactionChoice,
    user_feedback: userFeedback || null,
    coach_response: coachResponse || null,
    adjustments: adjustments ? {
      calorieChange: adjustments.calorieChange,
      proteinChange: adjustments.proteinChange,
      reason: adjustments.reason,
    } : null,
    // Snapshot of current targets
    target_calories: baseline.target_calories,
    protein_grams: baseline.protein_grams,
    carbs_grams: baseline.carbs_grams,
    fats_grams: baseline.fats_grams,
    // Snapshot of measurements
    weight: measurements?.weight ?? baseline.weight,
    body_fat_percentage: measurements?.bodyFatPercentage ?? baseline.body_fat_percentage,
    waist_cm: measurements?.waistCm ?? baseline.waist_cm,
    hip_cm: measurements?.hipCm ?? baseline.hip_cm,
    chest_cm: measurements?.chestCm ?? baseline.chest_cm,
    arm_cm: measurements?.armCm ?? baseline.arm_cm,
    thigh_cm: measurements?.thighCm ?? baseline.thigh_cm,
    neck_cm: measurements?.neckCm ?? baseline.neck_cm,
  });

  if (error) {
    console.error("Error saving progress update:", error);
    throw error;
  }
};

/**
 * Get all progress updates for the current user
 */
export const getProgressUpdates = async (): Promise<ProgressUpdate[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("progress_updates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching progress updates:", error);
    throw error;
  }

  return (data || []).map((item) => ({
    ...item,
    adjustments: item.adjustments as ProgressUpdate["adjustments"],
  }));
};

/**
 * Get the most recent progress update
 */
export const getLatestProgressUpdate = async (): Promise<ProgressUpdate | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("progress_updates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest progress update:", error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    adjustments: data.adjustments as ProgressUpdate["adjustments"],
  };
};
