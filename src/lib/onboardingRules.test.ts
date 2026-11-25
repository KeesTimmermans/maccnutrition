import { describe, it, expect } from "vitest";
import { canProceed, defaultUnitSystem, type OnboardingRuleData } from "./onboardingRules";

const full: OnboardingRuleData = {
  name: "Sam", age: "30", sex: "female", unitSystem: "metric", heightCm: "170", heightFeet: "",
  weight: "65", primaryGoal: "fat_loss", trainingDays: "2-3", activityLevel: "active", dietType: "omnivore",
};

describe("onboarding screen 1 (about you)", () => {
  it("passes with all fields", () => expect(canProceed("demographics", full)).toBe(true));
  for (const k of ["name", "age", "sex", "heightCm", "weight"] as const) {
    it(`needs ${k}`, () => expect(canProceed("demographics", { ...full, [k]: "" })).toBe(false));
  }
  it("blank name doesn't count", () => expect(canProceed("demographics", { ...full, name: "  " })).toBe(false));
  it("imperial needs feet, not cm", () => {
    expect(canProceed("demographics", { ...full, unitSystem: "imperial", heightCm: "", heightFeet: "5" })).toBe(true);
    expect(canProceed("demographics", { ...full, unitSystem: "imperial", heightFeet: "" })).toBe(false);
  });
});

describe("onboarding screen 2 (goal and week)", () => {
  it("passes with all fields", () => expect(canProceed("goals_week", full)).toBe(true));
  for (const k of ["primaryGoal", "trainingDays", "activityLevel"] as const) {
    it(`needs ${k}`, () => expect(canProceed("goals_week", { ...full, [k]: "" })).toBe(false));
  }
});

describe("onboarding screen 3 (food)", () => {
  it("needs diet type only", () => {
    expect(canProceed("food", full)).toBe(true);
    expect(canProceed("food", { ...full, dietType: "" })).toBe(false);
  });
  it("coaching tone is not required", () => {
    expect(canProceed("food", { ...full, coachingTone: "" } as OnboardingRuleData)).toBe(true);
  });
});

describe("cycle screen", () => {
  it("is skippable", () => expect(canProceed("female", { ...full, cycleRegularity: "" } as OnboardingRuleData)).toBe(true));
});

describe("default units", () => {
  it("US English is imperial", () => expect(defaultUnitSystem("en-US")).toBe("imperial"));
  it("others are metric", () => {
    expect(defaultUnitSystem("en-GB")).toBe("metric");
    expect(defaultUnitSystem("fr-FR")).toBe("metric");
    expect(defaultUnitSystem(undefined)).toBe("metric");
  });
});
