/**
 * Competition Prep Decision Engine
 *
 * Deterministic calculation of phase, mode, calories, macros, and guidance
 * based on event demands, timeline, goal, and user profile.
 */

import type {
  EventType, CompGoal, PrepPhase, NutritionMode,
  CompetitionPrepResult, EventDemandProfile, WeeklyCheckinInput, WeeklyAdjustment,
} from "./types";
import { EVENT_DEMAND_PROFILES } from "./eventProfiles";

// ── Phase determination ─────────────────────────────────────────
export function getPhase(daysOut: number): PrepPhase {
  if (daysOut > 112) return "foundation";      // 16+ weeks
  if (daysOut > 56)  return "build";           // 9-15 weeks
  if (daysOut > 21)  return "specific_prep";   // 4-8 weeks
  if (daysOut > 13)  return "performance_protection"; // 2-3 weeks
  if (daysOut > 6)   return "taper";           // 7-13 days
  return "race_week";                          // 0-6 days
}

const PHASE_LABELS: Record<PrepPhase, string> = {
  foundation: "Foundation Phase",
  build: "Build Phase",
  specific_prep: "Specific Prep Phase",
  performance_protection: "Performance Protection Phase",
  taper: "Taper Phase",
  race_week: "Race Week",
};

// ── Mode determination ──────────────────────────────────────────
export function getMode(goal: CompGoal, daysOut: number): NutritionMode {
  const weeksOut = Math.ceil(daysOut / 7);

  const modeMap: Record<CompGoal, (w: number) => NutritionMode> = {
    lose_weight: (w) => {
      if (w >= 9) return "fat_loss";
      if (w >= 4) return "fat_loss"; // conservative variant handled in calorie logic
      return "peak";
    },
    improve_performance: (w) => w <= 3 ? "peak" : "performance_build",
    build_strength: (w) => {
      if (w <= 3) return "peak";
      if (w <= 8) return "strength_support"; // may shift to perf build for endurance events
      return "strength_support";
    },
    improve_endurance: (w) => w <= 3 ? "peak" : "performance_build",
    recomp: (w) => {
      if (w <= 3) return "peak";
      if (w <= 8) return "performance_build";
      return "recomp";
    },
    maintain_and_peak: () => "peak",
  };

  return modeMap[goal](weeksOut);
}

const MODE_LABELS: Record<NutritionMode, string> = {
  fat_loss: "Fat Loss",
  recomp: "Recomp",
  performance_build: "Performance Build",
  strength_support: "Strength Support",
  peak: "Peak",
};

// ── Calorie logic ───────────────────────────────────────────────
function getCalorieModifier(mode: NutritionMode, daysOut: number, demand: EventDemandProfile): number {
  const weeksOut = Math.ceil(daysOut / 7);

  switch (mode) {
    case "fat_loss": {
      // Conservative near event
      if (weeksOut <= 3) return 0;     // maintenance
      if (weeksOut <= 8) return -0.10; // conservative
      return -0.125;                    // standard 10-15% range midpoint
    }
    case "recomp":
      return -0.05; // 5% deficit
    case "performance_build":
      return demand.maxStrength >= 4 ? 0.03 : 0.02; // slight surplus
    case "strength_support":
      return demand.bodyweightSensitivity >= 4 ? 0 : 0.05;
    case "peak":
      return 0.02; // slight surplus for carb loading
    default:
      return 0;
  }
}

// ── Protein logic ───────────────────────────────────────────────
function getProteinPerKg(mode: NutritionMode): number {
  switch (mode) {
    case "fat_loss":
    case "recomp":
      return 2.0;
    case "strength_support":
      return 1.8;
    case "performance_build":
    case "peak":
      return 1.8;
    default:
      return 1.8;
  }
}

// ── Fat logic (three-tier: preferred → reduced → hard floor) ────
function getFatFloorPerKg(demand: EventDemandProfile): number {
  if (demand.endurance >= 4 || demand.glycogen >= 4) return 0.6;
  return 0.7;
}

function getFatReducedPerKg(demand: EventDemandProfile): number {
  if (demand.endurance >= 4 || demand.glycogen >= 4) return 0.8;
  return 0.85;
}

function getFatDefaultPerKg(mode: NutritionMode, demand: EventDemandProfile): number {
  const isHighEndurance = demand.endurance >= 4 || demand.glycogen >= 4;

  switch (mode) {
    case "fat_loss":
      return isHighEndurance ? 0.9 : 1.0;
    case "recomp":
      return isHighEndurance ? 0.9 : 1.0;
    case "performance_build":
      return isHighEndurance ? 0.9 : 1.0;
    case "strength_support":
      return isHighEndurance ? 1.0 : 1.1;
    case "peak":
      return isHighEndurance ? 0.9 : 1.0;
    default:
      return 1.0;
  }
}

// ── Carb floor logic ────────────────────────────────────────────
function getCarbFloorPerKg(eventType: EventType, mode: NutritionMode): number {
  if (eventType === "hyrox" || eventType === "athx") return 3.0;
  if (eventType === "deka" || eventType === "turf_games" || eventType === "metrix") return 2.5;
  if (mode === "strength_support") return 2.0;
  return 2.5;
}

// ── Weight loss rate ────────────────────────────────────────────
function getSafeWeightLossRate(daysOut: number, demand: EventDemandProfile): { min: number; max: number } | null {
  if (daysOut <= 7) return null; // no deliberate loss
  if (daysOut <= 14) return { min: 0, max: 0.15 }; // very mild tidy-up
  if (daysOut <= 21) return { min: 0, max: 0.25 }; // no aggressive deficit

  // Higher bodyweight sensitivity → tighter range
  if (demand.bodyweightSensitivity >= 4) return { min: 0.25, max: 0.5 };
  return { min: 0.25, max: 0.75 };
}

// ── Training day cycling ────────────────────────────────────────
function getTrainingDayCycling(mode: NutritionMode, baseCals: number): { training: number; rest: number } {
  let swing = 200;
  if (mode === "peak" || mode === "performance_build") swing = 250;
  if (mode === "fat_loss") swing = 150;

  return {
    training: baseCals + swing,
    rest: baseCals - swing,
  };
}

// ── Priorities ──────────────────────────────────────────────────
function getPriorities(goal: CompGoal, daysOut: number): string[] {
  const weeksOut = Math.ceil(daysOut / 7);

  if (weeksOut <= 3) return ["Performance", "Recovery", "Body composition"];
  if (weeksOut <= 8) return ["Performance", goal === "lose_weight" ? "Gradual fat loss" : "Chosen goal", "Recovery"];
  return [goalLabel(goal), "Performance support", "Recovery"];
}

function goalLabel(g: CompGoal): string {
  const map: Record<CompGoal, string> = {
    lose_weight: "Reduce bodyweight gradually",
    improve_performance: "Improve performance",
    build_strength: "Build strength",
    improve_endurance: "Improve endurance",
    recomp: "Body recomposition",
    maintain_and_peak: "Maintain and peak",
  };
  return map[g];
}

// ── Taper / race-week guidance ──────────────────────────────────
function getTaperGuidance(phase: PrepPhase, demand: EventDemandProfile): string[] | null {
  if (phase === "taper") {
    return [
      "Move toward maintenance calories",
      "Stop any aggressive fat loss",
      "Maintain protein intake",
      "Slightly raise carbs if training is still meaningful",
      demand.fuelingPrecision >= 4 ? "Reduce fiber only if GI-sensitive" : "Keep diet consistent",
    ];
  }
  if (phase === "race_week") {
    const tips = [
      "Keep foods familiar — no new experiments",
      "Keep hydration consistent",
      "Avoid cheat meals or large calorie swings",
      "Prioritize digestion, sleep, and sodium consistency",
    ];
    if (demand.glycogen >= 4) {
      tips.push("Increase carbs modestly in the final 1-2 days");
      tips.push("Reduce very high-fiber and high-fat meals if GI issues are common");
    }
    return tips;
  }
  return null;
}

// ── Hydration notes ─────────────────────────────────────────────
function getHydrationNotes(phase: PrepPhase): string[] | null {
  if (phase === "taper" || phase === "race_week") {
    return [
      "Show hydration guidance more prominently",
      "Encourage consistent fluids and sodium",
      "Avoid excessive water loading",
      "Add electrolytes during long or hot sessions",
    ];
  }
  return null;
}

// ── Goal weight realism check ───────────────────────────────────
function checkGoalWeight(
  currentWeight: number,
  goalWeight: number | undefined,
  daysOut: number,
  demand: EventDemandProfile,
): { realistic: boolean; warning: string | null; projected: { low: number; high: number } | null } {
  if (!goalWeight || goalWeight >= currentWeight) {
    return { realistic: true, warning: null, projected: null };
  }

  const weeksRemaining = Math.max(1, Math.floor(daysOut / 7));
  const totalToLose = currentWeight - goalWeight;
  const requiredPerWeek = totalToLose / weeksRemaining;
  const safeRate = getSafeWeightLossRate(daysOut, demand);

  if (!safeRate) {
    return {
      realistic: false,
      warning: "Too close to event for deliberate weight loss.",
      projected: null,
    };
  }

  const maxSafePerWeek = (safeRate.max / 100) * currentWeight;
  const minSafePerWeek = (safeRate.min / 100) * currentWeight;

  if (requiredPerWeek > maxSafePerWeek) {
    const realisticLossTotal = maxSafePerWeek * weeksRemaining;
    const conservativeLossTotal = minSafePerWeek * weeksRemaining;
    return {
      realistic: false,
      warning: `This target would require losing ${requiredPerWeek.toFixed(1)} kg/week. That's likely too aggressive for maintaining performance. A more realistic target by event day is ${(currentWeight - realisticLossTotal).toFixed(1)}–${(currentWeight - conservativeLossTotal).toFixed(1)} kg.`,
      projected: {
        low: Math.round((currentWeight - realisticLossTotal) * 10) / 10,
        high: Math.round((currentWeight - conservativeLossTotal) * 10) / 10,
      },
    };
  }

  const projected = {
    low: Math.round((currentWeight - maxSafePerWeek * weeksRemaining) * 10) / 10,
    high: Math.round((currentWeight - minSafePerWeek * weeksRemaining) * 10) / 10,
  };

  return { realistic: true, warning: null, projected };
}

// ── Phase change explanation ────────────────────────────────────
function getExplanation(mode: NutritionMode, phase: PrepPhase, goal: CompGoal, weeksOut: number, eventLabel: string): string {
  if (phase === "race_week") {
    return `Race week is here. Your nutrition is focused entirely on fueling performance for ${eventLabel}. Keep things familiar and consistent.`;
  }
  if (phase === "taper") {
    return `You're in taper mode for ${eventLabel}. Calories have shifted toward maintenance to protect performance and recovery.`;
  }
  if (phase === "performance_protection") {
    return `Your event is close enough that performance matters more than aggressive body composition changes. Calories and carbs have been adjusted to protect training quality.`;
  }
  if (mode === "fat_loss" && phase === "specific_prep") {
    return `You're ${weeksOut} weeks from ${eventLabel}. Fat loss continues but at a conservative rate to maintain training quality and recovery.`;
  }
  if (mode === "fat_loss") {
    return `You have ${weeksOut} weeks until ${eventLabel}. Your plan uses a moderate calorie deficit while keeping protein high and carbs above the event floor to support training.`;
  }
  if (mode === "peak") {
    return `Your plan is focused on peaking for ${eventLabel}. Calories are at or slightly above maintenance with extra carbs around key sessions.`;
  }
  return `Your plan is optimized for ${goalLabel(goal).toLowerCase()} with ${weeksOut} weeks until ${eventLabel}. The plan will adapt as the event gets closer.`;
}

// ════════════════════════════════════════════════════════════════
//  MAIN CALCULATION
// ════════════════════════════════════════════════════════════════

export interface CompPrepCalcInput {
  eventType: EventType;
  eventDate: string;
  primaryGoal: CompGoal;
  goalWeight?: number;
  // From user baseline
  weightKg: number;
  tdee: number;
}

export function calculateCompetitionPrep(input: CompPrepCalcInput): CompetitionPrepResult {
  const { eventType, eventDate, primaryGoal, goalWeight, weightKg, tdee } = input;

  const now = new Date();
  const event = new Date(eventDate);
  const daysOut = Math.max(0, Math.floor((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const weeksOut = Math.max(0, Math.ceil(daysOut / 7));

  const demand = EVENT_DEMAND_PROFILES[eventType];
  const phase = getPhase(daysOut);
  const mode = getMode(primaryGoal, daysOut);

  // ── Calories ──
  const modifier = getCalorieModifier(mode, daysOut, demand);
  const baseCals = Math.round(tdee * (1 + modifier));

  // ── Protein ──
  const proteinPerKg = getProteinPerKg(mode);
  const proteinGrams = Math.round(weightKg * proteinPerKg);
  const proteinCals = proteinGrams * 4;

  // ── Fat (start at preferred, step down through 3 tiers if needed) ──
  const fatPreferred = getFatDefaultPerKg(mode, demand);
  const fatReduced = getFatReducedPerKg(demand);
  const fatFloor = getFatFloorPerKg(demand);
  let fatGrams = Math.round(weightKg * fatPreferred);
  let fatCals = fatGrams * 9;

  // ── Carbs (flexible lever) ──
  let carbCals = baseCals - proteinCals - fatCals;
  let carbGrams = Math.round(carbCals / 4);

  // Enforce carb floor using 3-tier fat reduction
  const carbFloor = getCarbFloorPerKg(eventType, mode);
  const carbFloorGrams = Math.round(weightKg * carbFloor);
  if (carbGrams < carbFloorGrams) {
    const fatReducedGrams = Math.round(weightKg * fatReduced);
    const fatFloorGrams = Math.round(weightKg * fatFloor);

    // Tier 1: try reducing fat toward the acceptable reduced level
    const carbsAtReduced = Math.round((baseCals - proteinCals - fatReducedGrams * 9) / 4);
    if (carbsAtReduced >= carbFloorGrams) {
      const carbDeficitCals = (carbFloorGrams - carbGrams) * 4;
      const fatReduce = Math.ceil(carbDeficitCals / 9);
      fatGrams = Math.max(fatGrams - fatReduce, fatReducedGrams);
      fatCals = fatGrams * 9;
      carbGrams = Math.round((baseCals - proteinCals - fatCals) / 4);
    } else {
      // Tier 2: try reducing fat toward hard floor
      const carbsAtFloor = Math.round((baseCals - proteinCals - fatFloorGrams * 9) / 4);
      if (carbsAtFloor >= carbFloorGrams) {
        const neededCarbCals = (carbFloorGrams - carbsAtReduced) * 4;
        const extraReduce = Math.ceil(neededCarbCals / 9);
        fatGrams = Math.max(fatReducedGrams - extraReduce, fatFloorGrams);
        fatCals = fatGrams * 9;
        carbGrams = Math.round((baseCals - proteinCals - fatCals) / 4);
      } else {
        // Tier 3: raise calories to meet carb floor
        fatGrams = fatFloorGrams;
        fatCals = fatGrams * 9;
        carbGrams = carbFloorGrams;
      }
    }
  }

  const finalCals = proteinCals + (carbGrams * 4) + fatCals;

  // ── Training day cycling ──
  const cycling = getTrainingDayCycling(mode, finalCals);

  // ── Weight loss rate ──
  const safeRate = getSafeWeightLossRate(daysOut, demand);
  const weightLossRatePct = mode === "fat_loss" && safeRate ? (safeRate.min + safeRate.max) / 2 : null;

  // ── Goal weight check ──
  const goalCheck = checkGoalWeight(weightKg, goalWeight, daysOut, demand);

  // ── Projected event weight ──
  let projectedWeight = goalCheck.projected;
  if (!projectedWeight && mode === "fat_loss" && safeRate) {
    const maxLoss = (safeRate.max / 100) * weightKg * weeksOut;
    const minLoss = (safeRate.min / 100) * weightKg * weeksOut;
    projectedWeight = {
      low: Math.round((weightKg - maxLoss) * 10) / 10,
      high: Math.round((weightKg - minLoss) * 10) / 10,
    };
  }

  const eventLabel = eventType.toUpperCase().replace("_", " ");

  return {
    phase,
    phaseLabel: PHASE_LABELS[phase],
    mode,
    modeLabel: mode === "fat_loss" && phase === "specific_prep"
      ? "Fat Loss with Performance Protection"
      : MODE_LABELS[mode],
    weeksOut,
    daysOut,
    calories: finalCals,
    trainingDayCalories: cycling.training,
    restDayCalories: cycling.rest,
    protein: proteinGrams,
    carbs: carbGrams,
    fats: fatGrams,
    weightLossRatePct,
    projectedEventWeight: projectedWeight,
    goalWeightRealistic: goalCheck.realistic,
    goalWeightWarning: goalCheck.warning,
    priorities: getPriorities(primaryGoal, daysOut),
    explanation: getExplanation(mode, phase, primaryGoal, weeksOut, eventLabel),
    taperGuidance: getTaperGuidance(phase, demand),
    hydrationNotes: getHydrationNotes(phase),
  };
}

// ════════════════════════════════════════════════════════════════
//  WEEKLY ADJUSTMENT ENGINE
// ════════════════════════════════════════════════════════════════

export function calculateWeeklyAdjustment(
  checkin: WeeklyCheckinInput,
  prevCheckin: WeeklyCheckinInput | null,
  currentResult: CompetitionPrepResult,
  targetWeightKg: number,
): WeeklyAdjustment {
  let calorieChange = 0;
  let carbChange = 0;
  let fatChange = 0;
  const proteinChange = 0;
  const reasons: string[] = [];

  const weightDelta = prevCheckin ? checkin.avgWeight - prevCheckin.avgWeight : 0;
  const weeklyLossRate = prevCheckin && prevCheckin.avgWeight > 0
    ? ((prevCheckin.avgWeight - checkin.avgWeight) / prevCheckin.avgWeight) * 100
    : 0;

  // ── A. Weight-loss adjustments ──
  if (currentResult.weightLossRatePct !== null && prevCheckin) {
    const targetRate = currentResult.weightLossRatePct;

    if (weeklyLossRate > targetRate * 1.3) {
      // Losing too fast
      calorieChange += 125;
      carbChange += Math.round(125 / 4);
      reasons.push("Weight loss faster than target — adding calories from carbs");
    } else if (weeklyLossRate < targetRate * 0.5 && checkin.adherencePct >= 80) {
      // Losing too slow with good adherence
      calorieChange -= 125;
      carbChange -= Math.round(75 / 4);
      fatChange -= Math.round(50 / 9);
      reasons.push("Weight loss slower than target with good adherence — small calorie reduction");
    } else if (weeklyLossRate < targetRate * 0.5 && checkin.adherencePct < 80) {
      reasons.push("Weight stable but adherence could improve — focus on consistency before adjusting calories");
    }
  }

  // ── B. Performance protection ──
  if (checkin.performanceTrend === "declining" && checkin.adherencePct >= 80) {
    calorieChange += 150;
    carbChange += Math.round(150 / 4);
    reasons.push("Performance declining — adding carbs around training");
  }

  if (checkin.recoveryLevel <= 2) {
    calorieChange += 100;
    carbChange += Math.round(100 / 4);
    reasons.push("Recovery is poor — reducing deficit and adding carbs");
  }

  if (checkin.hungerLevel >= 4 && currentResult.daysOut <= 21) {
    calorieChange += 100;
    carbChange += Math.round(60 / 4);
    fatChange += Math.round(40 / 9);
    reasons.push("High hunger close to event — moving toward maintenance");
  }

  // ── C. Timeline override ──
  if (currentResult.daysOut <= 21 && calorieChange < 0) {
    calorieChange = 0;
    carbChange = 0;
    fatChange = 0;
    reasons.length = 0;
    reasons.push("Within 21 days of event — performance logic overrides fat-loss adjustments");
  }

  return {
    calorieChange,
    carbChange,
    fatChange,
    proteinChange,
    reason: reasons.length > 0 ? reasons.join(". ") : "No adjustment needed this week — keep consistent.",
  };
}
