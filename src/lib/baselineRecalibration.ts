import { supabase } from "@/integrations/supabase/client";
import { UserBaseline } from "./userService";
import { DailyCheckIn, getRecentCheckIns } from "./checkinService";

export interface RecalibrationResult {
  shouldRecalibrate: boolean;
  daysSinceLastUpdate: number;
  adherenceRate: number;
  adjustments: {
    calorieAdjustment: number;
    proteinAdjustment: number;
    carbsAdjustment: number;
    fatsAdjustment: number;
    reason: string[];
  };
  newBaseline: {
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
  } | null;
}

interface MealLog {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  logged_at: string;
}

interface WearableData {
  recovery_score: number | null;
  hrv_average: number | null;
  sleep_quality_score: number | null;
  energy_level?: number;
  data_date: string;
}

/**
 * Check if baseline needs recalibration (every 2 weeks)
 */
export async function checkRecalibrationNeeded(baseline: UserBaseline): Promise<RecalibrationResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return createEmptyResult();
  }

  // Calculate days since last update
  const lastUpdate = new Date(baseline.updated_at || baseline.created_at || new Date());
  const now = new Date();
  const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));

  // Only recalibrate if at least 14 days have passed
  if (daysSinceLastUpdate < 14) {
    return {
      shouldRecalibrate: false,
      daysSinceLastUpdate,
      adherenceRate: 0,
      adjustments: { calorieAdjustment: 0, proteinAdjustment: 0, carbsAdjustment: 0, fatsAdjustment: 0, reason: [] },
      newBaseline: null,
    };
  }

  // Gather data from last 14 days
  const [checkIns, mealLogs, wearableData] = await Promise.all([
    getRecentCheckIns(14),
    getMealLogsLast14Days(user.id),
    getWearableDataLast14Days(user.id),
  ]);

  // Calculate adherence rate (days with at least 2 meals logged / 14)
  const adherenceRate = calculateAdherenceRate(mealLogs);

  // Analyze patterns
  const adjustments = analyzeAndCalculateAdjustments(baseline, checkIns, mealLogs, wearableData, adherenceRate);

  // Determine if we should recalibrate
  const shouldRecalibrate = adjustments.reason.length > 0 && adherenceRate >= 0.5;

  // Calculate new baseline values
  let newBaseline = null;
  if (shouldRecalibrate) {
    newBaseline = {
      targetCalories: Math.round((baseline.target_calories || 2000) + adjustments.calorieAdjustment),
      proteinGrams: Math.round((baseline.protein_grams || 120) + adjustments.proteinAdjustment),
      carbsGrams: Math.round((baseline.carbs_grams || 200) + adjustments.carbsAdjustment),
      fatsGrams: Math.round((baseline.fats_grams || 65) + adjustments.fatsAdjustment),
    };
  }

  return {
    shouldRecalibrate,
    daysSinceLastUpdate,
    adherenceRate,
    adjustments,
    newBaseline,
  };
}

/**
 * Apply recalibration when user wants "more progress"
 * This increases the deficit/intensity based on their goal
 */
export async function applyProgressBoost(baseline: UserBaseline): Promise<{
  success: boolean;
  adjustments: {
    calorieChange: number;
    proteinChange: number;
    reason: string;
  };
  newTargets: {
    targetCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatsGrams: number;
  } | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, adjustments: { calorieChange: 0, proteinChange: 0, reason: 'Not authenticated' }, newTargets: null };
  }

  const currentCalories = baseline.target_calories || 2000;
  const currentProtein = baseline.protein_grams || 120;
  const currentCarbs = baseline.carbs_grams || 200;
  const currentFats = baseline.fats_grams || 65;
  const goal = baseline.primary_goal || 'general_health';

  let calorieChange = 0;
  let proteinChange = 0;
  let carbsChange = 0;
  let fatsChange = 0;
  let reason = '';

  // Apply adjustments based on goal
  if (goal === 'fat_loss' || goal === 'weight_loss') {
    // Increase deficit by 5-10% (up to 300 cal max reduction)
    calorieChange = -Math.min(Math.round(currentCalories * 0.07), 300);
    // Boost protein to preserve muscle during harder cut
    proteinChange = Math.round(currentProtein * 0.1);
    // Reduce carbs slightly
    carbsChange = -Math.round(currentCarbs * 0.1);
    reason = 'Increased calorie deficit and boosted protein for accelerated fat loss';
  } else if (goal === 'muscle_gain' || goal === 'performance') {
    // Increase surplus slightly
    calorieChange = Math.round(currentCalories * 0.05);
    // Boost protein for muscle synthesis
    proteinChange = Math.round(currentProtein * 0.1);
    // Add carbs for training fuel
    carbsChange = Math.round(currentCarbs * 0.1);
    reason = 'Increased calories and protein to support muscle growth';
  } else if (goal === 'body_recomposition') {
    // Keep calories same but shift macros
    proteinChange = Math.round(currentProtein * 0.15);
    carbsChange = -Math.round(currentCarbs * 0.05);
    reason = 'Boosted protein for body recomposition while maintaining calories';
  } else {
    // General health - modest increase in protein, slight calorie adjustment
    proteinChange = 10;
    reason = 'Modest protein boost to support your progress goals';
  }

  const newTargets = {
    targetCalories: Math.round(currentCalories + calorieChange),
    proteinGrams: Math.round(currentProtein + proteinChange),
    carbsGrams: Math.round(currentCarbs + carbsChange),
    fatsGrams: Math.round(currentFats + fatsChange),
  };

  // Apply the changes
  const { error } = await supabase
    .from('user_baselines')
    .update({
      target_calories: newTargets.targetCalories,
      protein_grams: newTargets.proteinGrams,
      carbs_grams: newTargets.carbsGrams,
      fats_grams: newTargets.fatsGrams,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error applying progress boost:', error);
    return { success: false, adjustments: { calorieChange: 0, proteinChange: 0, reason: 'Database error' }, newTargets: null };
  }

  console.log('Progress boost applied:', { calorieChange, proteinChange, reason, newTargets });

  return {
    success: true,
    adjustments: { calorieChange, proteinChange, reason },
    newTargets,
  };
}

/**
 * Apply recalibration to user baseline
 */
export async function applyRecalibration(result: RecalibrationResult): Promise<boolean> {
  if (!result.shouldRecalibrate || !result.newBaseline) {
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_baselines')
    .update({
      target_calories: result.newBaseline.targetCalories,
      protein_grams: result.newBaseline.proteinGrams,
      carbs_grams: result.newBaseline.carbsGrams,
      fats_grams: result.newBaseline.fatsGrams,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Error applying recalibration:', error);
    return false;
  }

  // Store recalibration history for reference
  console.log('Baseline recalibrated:', {
    adjustments: result.adjustments,
    newBaseline: result.newBaseline,
    adherenceRate: result.adherenceRate,
  });

  return true;
}

async function getMealLogsLast14Days(userId: string): Promise<MealLog[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);

  const { data, error } = await supabase
    .from('meals')
    .select('calories, protein, carbs, fats, logged_at')
    .eq('user_id', userId)
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: false });

  if (error) {
    console.error('Error fetching meal logs:', error);
    return [];
  }

  return data || [];
}

async function getWearableDataLast14Days(userId: string): Promise<WearableData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 14);

  const { data, error } = await supabase
    .from('wearable_data')
    .select('recovery_score, hrv_average, sleep_quality_score, data_date')
    .eq('user_id', userId)
    .gte('data_date', startDate.toISOString().split('T')[0])
    .order('data_date', { ascending: false });

  if (error) {
    console.error('Error fetching wearable data:', error);
    return [];
  }

  return data || [];
}

function calculateAdherenceRate(mealLogs: MealLog[]): number {
  // Group meals by date
  const mealsByDate = new Map<string, number>();
  
  mealLogs.forEach(meal => {
    const date = new Date(meal.logged_at).toISOString().split('T')[0];
    mealsByDate.set(date, (mealsByDate.get(date) || 0) + 1);
  });

  // Count days with at least 2 meals logged
  let daysWithAdequateMeals = 0;
  mealsByDate.forEach(count => {
    if (count >= 2) daysWithAdequateMeals++;
  });

  return daysWithAdequateMeals / 14;
}

function analyzeAndCalculateAdjustments(
  baseline: UserBaseline,
  checkIns: DailyCheckIn[],
  mealLogs: MealLog[],
  wearableData: WearableData[],
  adherenceRate: number
): RecalibrationResult['adjustments'] {
  const reasons: string[] = [];
  let calorieAdjustment = 0;
  let proteinAdjustment = 0;
  let carbsAdjustment = 0;
  let fatsAdjustment = 0;

  const currentCalories = baseline.target_calories || 2000;
  const goal = baseline.primary_goal || 'general_health';

  // Analyze check-in patterns
  if (checkIns.length >= 7) {
    const avgEnergy = checkIns.reduce((sum, c) => sum + (c.energy_level || 3), 0) / checkIns.length;
    const avgSleep = checkIns.reduce((sum, c) => sum + (c.sleep_quality || 3), 0) / checkIns.length;
    const avgStress = checkIns.reduce((sum, c) => sum + (c.stress_level || 3), 0) / checkIns.length;

    // Low energy + high adherence for fat loss = deficit too aggressive
    if (goal === 'fat_loss' && avgEnergy < 2.5 && adherenceRate >= 0.7) {
      calorieAdjustment += Math.round(currentCalories * 0.05); // Reduce deficit by 5%
      carbsAdjustment += 30; // Add 30g carbs
      reasons.push(`Energy low (${avgEnergy.toFixed(1)}/5) with good adherence - reducing deficit`);
    }

    // Low sleep quality = boost recovery nutrients
    if (avgSleep < 2.5) {
      fatsAdjustment += 10; // More healthy fats for hormone support
      reasons.push(`Sleep quality poor (${avgSleep.toFixed(1)}/5) - increasing fats for recovery`);
    }

    // High stress = shift from carbs to fats for sustained energy
    if (avgStress > 3.5) {
      carbsAdjustment -= 20;
      fatsAdjustment += 8;
      reasons.push(`Elevated stress (${avgStress.toFixed(1)}/5) - shifting to more fats for stable energy`);
    }
  }

  // Analyze wearable data (HRV, recovery scores)
  if (wearableData.length >= 7) {
    const avgRecovery = wearableData
      .filter(w => w.recovery_score !== null)
      .reduce((sum, w) => sum + (w.recovery_score || 0), 0) / 
      Math.max(1, wearableData.filter(w => w.recovery_score !== null).length);

    const avgHRV = wearableData
      .filter(w => w.hrv_average !== null)
      .reduce((sum, w) => sum + (w.hrv_average || 0), 0) /
      Math.max(1, wearableData.filter(w => w.hrv_average !== null).length);

    // Low recovery score trending
    if (avgRecovery > 0 && avgRecovery < 50) {
      calorieAdjustment += Math.round(currentCalories * 0.03);
      proteinAdjustment += 10;
      reasons.push(`Low recovery scores (avg ${Math.round(avgRecovery)}%) - boosting calories and protein`);
    }

    // HRV declining trend (compare first half vs second half)
    if (wearableData.length >= 10) {
      const recentHRV = wearableData.slice(0, 5).filter(w => w.hrv_average).map(w => w.hrv_average || 0);
      const olderHRV = wearableData.slice(5, 10).filter(w => w.hrv_average).map(w => w.hrv_average || 0);
      
      if (recentHRV.length > 0 && olderHRV.length > 0) {
        const recentAvg = recentHRV.reduce((a, b) => a + b, 0) / recentHRV.length;
        const olderAvg = olderHRV.reduce((a, b) => a + b, 0) / olderHRV.length;
        
        if (olderAvg > 0 && (recentAvg - olderAvg) / olderAvg < -0.1) {
          calorieAdjustment += Math.round(currentCalories * 0.05);
          reasons.push(`HRV declining trend detected - increasing calories to support recovery`);
        }
      }
    }
  }

  // Adherence-based adjustments
  if (adherenceRate >= 0.9 && goal === 'fat_loss' && reasons.length === 0) {
    // High adherence, no fatigue signals = can safely maintain or slightly increase deficit
    // But don't make changes if everything is working
  } else if (adherenceRate < 0.5) {
    // Low adherence might mean targets are too aggressive
    if (goal === 'fat_loss') {
      calorieAdjustment += Math.round(currentCalories * 0.05);
      reasons.push(`Low adherence (${Math.round(adherenceRate * 100)}%) - easing targets for sustainability`);
    }
  }

  return {
    calorieAdjustment,
    proteinAdjustment,
    carbsAdjustment,
    fatsAdjustment,
    reason: reasons,
  };
}

function createEmptyResult(): RecalibrationResult {
  return {
    shouldRecalibrate: false,
    daysSinceLastUpdate: 0,
    adherenceRate: 0,
    adjustments: { calorieAdjustment: 0, proteinAdjustment: 0, carbsAdjustment: 0, fatsAdjustment: 0, reason: [] },
    newBaseline: null,
  };
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
