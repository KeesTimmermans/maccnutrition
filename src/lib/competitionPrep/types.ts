// ── Competition Prep Types ──────────────────────────────────────

export type EventType = "hyrox" | "athx" | "5k" | "10k" | "half_marathon" | "full_marathon";

export type CompDivision = string;

export type CompGoal =
  | "lose_weight" | "improve_performance" | "build_strength"
  | "improve_endurance" | "recomp" | "maintain_and_peak";

export type PrepPhase =
  | "foundation" | "build" | "specific_prep"
  | "performance_protection" | "taper" | "race_week";

export type NutritionMode =
  | "fat_loss" | "recomp" | "performance_build"
  | "strength_support" | "peak";

export interface EventDemandProfile {
  endurance: number;       // 1-5
  glycogen: number;        // 1-5
  muscularEndurance: number; // 1-5
  maxStrength: number;     // 1-5
  bodyweightSensitivity: number; // 1-5
  fuelingPrecision: number; // 1-5
}

export interface CompetitionPrepInput {
  eventType: EventType;
  eventDate: string; // ISO date
  division: CompDivision;
  customDivision?: string;
  primaryGoal: CompGoal;
  goalWeight?: number;
}

export interface CompetitionPrepResult {
  phase: PrepPhase;
  phaseLabel: string;
  mode: NutritionMode;
  modeLabel: string;
  weeksOut: number;
  daysOut: number;
  calories: number;
  trainingDayCalories: number;
  restDayCalories: number;
  protein: number;
  carbs: number;
  fats: number;
  weightLossRatePct: number | null;
  projectedEventWeight: { low: number; high: number } | null;
  goalWeightRealistic: boolean;
  goalWeightWarning: string | null;
  priorities: string[];
  explanation: string;
  taperGuidance: string[] | null;
  hydrationNotes: string[] | null;
}

export interface WeeklyCheckinInput {
  avgWeight: number;
  adherencePct: number;
  hungerLevel: number;    // 1-5
  energyLevel: number;    // 1-5
  recoveryLevel: number;  // 1-5
  performanceTrend: "improving" | "stable" | "declining";
  cyclePhase?: string;
}

export interface WeeklyAdjustment {
  calorieChange: number;
  carbChange: number;
  fatChange: number;
  proteinChange: number;
  reason: string;
}
