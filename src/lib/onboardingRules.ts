/**
 * Required-field rules for the 3-screen signup (pure, tested).
 * Anything not required here belongs in the Today "Complete your profile" card.
 */
export type OnboardingStepId = "demographics" | "goals_week" | "food" | "female";

export interface OnboardingRuleData {
  name: string;
  age: string;
  sex: string;
  unitSystem: "imperial" | "metric";
  heightCm: string;
  heightFeet: string;
  weight: string;
  primaryGoal: string;
  trainingDays: string;
  activityLevel: string;
  dietType: string;
}

const filled = (v: string | undefined | null) => !!v && String(v).trim() !== "";

export const canProceed = (step: OnboardingStepId, d: OnboardingRuleData): boolean => {
  switch (step) {
    case "demographics": {
      const height = d.unitSystem === "imperial" ? d.heightFeet : d.heightCm;
      return filled(d.name) && filled(d.age) && filled(d.sex) && filled(height) && filled(d.weight);
    }
    case "goals_week":
      return filled(d.primaryGoal) && filled(d.trainingDays) && filled(d.activityLevel);
    case "food":
      // Food approach always has a value; coaching tone is pre-selected and never required.
      return filled(d.dietType);
    case "female":
      return true; // Skippable ("Skip for now")
    default:
      return true;
  }
};

/** US English browsers get imperial; everything else metric. */
export const defaultUnitSystem = (language: string | undefined | null): "imperial" | "metric" =>
  (language ?? "").toLowerCase() === "en-us" ? "imperial" : "metric";

export const MAIN_STEP_COUNT = 3;
