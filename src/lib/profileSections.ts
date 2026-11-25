import type { UserBaseline } from "@/lib/userService";
import type { OnboardingData } from "@/components/OnboardingQuestionnaire";

export type SectionId = "training" | "eating" | "journey" | "food";

export const PROFILE_SECTIONS: { id: SectionId; title: string; description: string; questionCount: number }[] = [
  { id: "training", title: "Training details", description: "Your job, workouts, climate, stress and sleep", questionCount: 6 },
  { id: "eating", title: "Eating habits", description: "How and when you eat", questionCount: 4 },
  { id: "journey", title: "Your journey", description: "Challenges, past diets and what keeps you going", questionCount: 8 },
  { id: "food", title: "Food preferences", description: "Shakes, snacks, water and dislikes", questionCount: 5 },
];

/** Baseline fields that must all be set for a section to count as complete. */
const REQUIRED_FIELDS: Record<SectionId, (keyof UserBaseline)[]> = {
  training: ["job_activity_level", "training_duration", "climate", "stress_level", "workout_types"],
  eating: ["eating_speed", "hunger_patterns"],
  journey: ["biggest_challenge", "meal_prep_time", "motivation_style"],
  food: ["protein_shakes_preference", "snacking_habits"],
};

const isSet = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

export const getIncompleteSections = (baseline: UserBaseline | null): SectionId[] => {
  if (!baseline) return [];
  return PROFILE_SECTIONS.map((s) => s.id).filter((id) =>
    REQUIRED_FIELDS[id].some((field) => {
      // The session-duration question is only asked to people who train 2+ days a week,
      // so it can't be required from people who train 0-1 days.
      if (field === "training_duration" && baseline.training_days === "0-1") return false;
      return !isSet(baseline[field]);
    }),
  );
};

const orNull = (value: string | undefined | null): string | null =>
  value && value.trim() !== "" ? value : null;

/** Snake_case partial update for ONLY the given section, same column mapping as saveUserBaseline. */
export const sectionToBaselineFields = (id: SectionId, data: OnboardingData): Record<string, unknown> => {
  switch (id) {
    case "training":
      return {
        job_activity_level: orNull(data.jobActivityLevel),
        workout_types: data.workoutTypes ?? [],
        training_duration: orNull(data.trainingDuration),
        climate: orNull(data.climate),
        stress_level: orNull(data.stressLevel),
        sleep_hours: orNull(data.sleepHours),
      };
    case "eating":
      return {
        eating_speed: orNull(data.eatingSpeed),
        hunger_patterns: orNull(data.hungerPatterns),
        cravings_triggers: data.cravingsTriggers ?? [],
        emotional_eating: orNull(data.emotionalEating),
      };
    case "journey":
      return {
        biggest_challenge: orNull(data.biggestChallenge),
        past_diets: data.pastDiets ?? [],
        meal_prep_time: orNull(data.mealPrepTime),
        cooking_skill: orNull(data.cookingSkill),
        eating_out_frequency: orNull(data.eatingOutFrequency),
        weekend_habits: orNull(data.weekendHabits),
        motivation_style: orNull(data.motivationStyle),
        accountability_preference: orNull(data.accountabilityPreference),
      };
    case "food":
      return {
        protein_shakes_preference: orNull(data.proteinShakesPreference),
        snacking_habits: orNull(data.snackingHabits),
        hydration_habits: orNull(data.hydrationHabits),
        energy_patterns: orNull(data.energyPatterns),
        food_dislikes: orNull(data.foodDislikes),
      };
  }
};

export const TARGET_AFFECTING = ["job_activity_level", "workout_types", "training_duration", "climate", "stress_level", "sleep_hours"];

export const affectsTargets = (fields: Record<string, unknown>): boolean =>
  Object.keys(fields).some((key) => TARGET_AFFECTING.includes(key));

/**
 * Pre-fill values for the profile sections straight from the stored answers.
 * (baselineToOnboardingData fills these with calculation defaults or blanks,
 * which would show answers the user never gave.)
 */
export const sectionPrefill = (baseline: UserBaseline): Partial<OnboardingData> => ({
  jobActivityLevel: baseline.job_activity_level ?? "",
  workoutTypes: baseline.workout_types ?? [],
  trainingDuration: baseline.training_duration ?? "",
  climate: baseline.climate ?? "",
  stressLevel: baseline.stress_level ?? "",
  sleepHours: baseline.sleep_hours ?? "",
  eatingSpeed: baseline.eating_speed ?? "",
  hungerPatterns: baseline.hunger_patterns ?? "",
  cravingsTriggers: baseline.cravings_triggers ?? [],
  emotionalEating: baseline.emotional_eating ?? "",
  biggestChallenge: baseline.biggest_challenge ?? "",
  pastDiets: baseline.past_diets ?? [],
  mealPrepTime: baseline.meal_prep_time ?? "",
  cookingSkill: baseline.cooking_skill ?? "",
  eatingOutFrequency: baseline.eating_out_frequency ?? "",
  weekendHabits: baseline.weekend_habits ?? "",
  motivationStyle: baseline.motivation_style ?? "",
  accountabilityPreference: baseline.accountability_preference ?? "",
  proteinShakesPreference: baseline.protein_shakes_preference ?? "",
  snackingHabits: baseline.snacking_habits ?? "",
  hydrationHabits: baseline.hydration_habits ?? "",
  energyPatterns: baseline.energy_patterns ?? "",
  foodDislikes: baseline.food_dislikes ?? "",
});
