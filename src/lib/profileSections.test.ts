import { describe, it, expect } from "vitest";
import {
  getIncompleteSections,
  sectionToBaselineFields,
  affectsTargets,
  PROFILE_SECTIONS,
} from "@/lib/profileSections";
import type { UserBaseline } from "@/lib/userService";
import type { OnboardingData } from "@/components/OnboardingQuestionnaire";

const filled = {
  training_days: "2-3",
  job_activity_level: "light",
  training_duration: "30_60",
  climate: "moderate",
  stress_level: "low",
  workout_types: ["weightlifting"],
  eating_speed: "fast",
  hunger_patterns: "evening",
  biggest_challenge: "evening_snacking",
  meal_prep_time: "30_min",
  motivation_style: "data_driven",
  protein_shakes_preference: "love",
  snacking_habits: "sometimes",
} as unknown as UserBaseline;

const b = (over: Record<string, unknown>) => ({ ...filled, ...over }) as unknown as UserBaseline;

describe("getIncompleteSections", () => {
  it("returns nothing for an existing user who answered everything", () => {
    expect(getIncompleteSections(filled)).toEqual([]);
  });

  it("returns nothing when there is no baseline", () => {
    expect(getIncompleteSections(null)).toEqual([]);
  });

  it("returns all four sections for a new short-signup user", () => {
    const fresh = b({
      job_activity_level: null, training_duration: null, climate: null, stress_level: null, workout_types: [],
      eating_speed: null, hunger_patterns: null, biggest_challenge: null, meal_prep_time: null,
      motivation_style: null, protein_shakes_preference: null, snacking_habits: null,
    });
    expect(getIncompleteSections(fresh)).toEqual(["training", "eating", "journey", "food"]);
  });

  it("training is incomplete when any training field is missing", () => {
    expect(getIncompleteSections(b({ climate: null }))).toEqual(["training"]);
    expect(getIncompleteSections(b({ stress_level: "" }))).toEqual(["training"]);
    expect(getIncompleteSections(b({ workout_types: [] }))).toEqual(["training"]);
    expect(getIncompleteSections(b({ workout_types: null }))).toEqual(["training"]);
  });

  it("training does not need session duration from people who train 0-1 days", () => {
    expect(getIncompleteSections(b({ training_days: "0-1", training_duration: null }))).toEqual([]);
    expect(getIncompleteSections(b({ training_days: "2-3", training_duration: null }))).toEqual(["training"]);
  });

  it("eating, journey and food each detect their own missing fields", () => {
    expect(getIncompleteSections(b({ hunger_patterns: null }))).toEqual(["eating"]);
    expect(getIncompleteSections(b({ motivation_style: null }))).toEqual(["journey"]);
    expect(getIncompleteSections(b({ meal_prep_time: "  " }))).toEqual(["journey"]);
    expect(getIncompleteSections(b({ snacking_habits: null }))).toEqual(["food"]);
  });
});

const data = {
  jobActivityLevel: "moderate", workoutTypes: ["hiit"], trainingDuration: "60_90", climate: "hot", stressLevel: "",
  eatingSpeed: "slow", hungerPatterns: "", cravingsTriggers: ["stress"], emotionalEating: "rarely",
  biggestChallenge: "time", pastDiets: [], mealPrepTime: "", cookingSkill: "beginner", eatingOutFrequency: "weekly",
  weekendHabits: "", motivationStyle: "habit_focused", accountabilityPreference: "",
  proteinShakesPreference: "never", snackingHabits: "often", hydrationHabits: "", energyPatterns: "morning", foodDislikes: "",
  dietType: "vegan", primaryGoal: "fat_loss", coachingTone: "direct",
} as unknown as OnboardingData;

describe("sectionToBaselineFields", () => {
  it("maps only the training fields, empty strings to null", () => {
    expect(sectionToBaselineFields("training", data)).toEqual({
      job_activity_level: "moderate", workout_types: ["hiit"], training_duration: "60_90", climate: "hot", stress_level: null,
    });
  });

  it("maps only the eating fields", () => {
    expect(sectionToBaselineFields("eating", data)).toEqual({
      eating_speed: "slow", hunger_patterns: null, cravings_triggers: ["stress"], emotional_eating: "rarely",
    });
  });

  it("maps only the journey fields, keeping empty arrays as arrays", () => {
    expect(sectionToBaselineFields("journey", data)).toEqual({
      biggest_challenge: "time", past_diets: [], meal_prep_time: null, cooking_skill: "beginner",
      eating_out_frequency: "weekly", weekend_habits: null, motivation_style: "habit_focused", accountability_preference: null,
    });
  });

  it("maps only the food fields", () => {
    expect(sectionToBaselineFields("food", data)).toEqual({
      protein_shakes_preference: "never", snacking_habits: "often", hydration_habits: null, energy_patterns: "morning", food_dislikes: null,
    });
  });

  it("question counts match the number of fields saved per section", () => {
    for (const s of PROFILE_SECTIONS) {
      expect(Object.keys(sectionToBaselineFields(s.id, data))).toHaveLength(s.questionCount);
    }
  });
});

describe("affectsTargets", () => {
  it("is true only for the training section", () => {
    expect(affectsTargets(sectionToBaselineFields("training", data))).toBe(true);
    expect(affectsTargets(sectionToBaselineFields("eating", data))).toBe(false);
    expect(affectsTargets(sectionToBaselineFields("journey", data))).toBe(false);
    expect(affectsTargets(sectionToBaselineFields("food", data))).toBe(false);
    expect(affectsTargets({ climate: "hot" })).toBe(true);
  });
});
