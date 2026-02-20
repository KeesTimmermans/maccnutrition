import { UserBaseline, recalculateNutritionFromBaseline } from "./userService";

/**
 * Full recalculation of all nutrition targets.
 * Replaces the old incremental recalibration logic.
 * Now simply delegates to recalculateNutritionFromBaseline which
 * re-runs calculateNutritionTargets from scratch.
 */
export async function applyFullRecalculation(baseline: UserBaseline): Promise<{
  success: boolean;
  reason: string;
  updatedBaseline: UserBaseline | null;
}> {
  try {
    const updated = await recalculateNutritionFromBaseline(baseline);
    if (!updated) {
      return { success: false, reason: "Not authenticated or update failed", updatedBaseline: null };
    }
    return {
      success: true,
      reason: "Targets recalculated from current profile fields",
      updatedBaseline: updated,
    };
  } catch (error) {
    console.error("Error during full recalculation:", error);
    return { success: false, reason: "Database error", updatedBaseline: null };
  }
}

/**
 * Get last recalibration date from baseline
 */
export function getLastRecalibrationInfo(baseline: UserBaseline): { 
  lastUpdate: Date; 
  daysSince: number; 
  nextRecalibration: Date 
} {
  const lastUpdate = new Date(baseline.updated_at || baseline.created_at || new Date());
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
  const nextRecalibration = new Date(lastUpdate);
  nextRecalibration.setDate(nextRecalibration.getDate() + 14);

  return { lastUpdate, daysSince, nextRecalibration };
}
