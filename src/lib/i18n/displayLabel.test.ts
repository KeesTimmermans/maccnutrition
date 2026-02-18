import { describe, it, expect } from "vitest";
import { toDisplayLabel } from "./displayLabel";

describe("toDisplayLabel", () => {
  // --- Explicit label-map overrides ---
  it("maps 'your_targets' to 'Your targets'", () => {
    expect(toDisplayLabel("your_targets")).toBe("Your targets");
  });

  it("maps 'cal_day' to 'Calories per day'", () => {
    expect(toDisplayLabel("cal_day")).toBe("Calories per day");
  });

  it("maps 'water_day' to 'Water per day'", () => {
    expect(toDisplayLabel("water_day")).toBe("Water per day");
  });

  it("maps 'current_focus' to 'Current focus'", () => {
    expect(toDisplayLabel("current_focus")).toBe("Current focus");
  });

  it("maps 'fat_loss' to 'Fat loss'", () => {
    expect(toDisplayLabel("fat_loss")).toBe("Fat loss");
  });

  it("maps 'muscle_gain' to 'Muscle gain'", () => {
    expect(toDisplayLabel("muscle_gain")).toBe("Muscle gain");
  });

  it("maps 'general_health' to 'General health'", () => {
    expect(toDisplayLabel("general_health")).toBe("General health");
  });

  it("maps 'health_markers' to 'Health markers'", () => {
    expect(toDisplayLabel("health_markers")).toBe("Health markers");
  });

  it("maps 'recomp' to 'Body recomposition'", () => {
    expect(toDisplayLabel("recomp")).toBe("Body recomposition");
  });

  // --- Automatic snake_case → Sentence case ---
  it("converts an unknown snake_case key automatically", () => {
    expect(toDisplayLabel("some_unknown_key")).toBe("Some unknown key");
  });

  it("converts a kebab-case key automatically", () => {
    expect(toDisplayLabel("some-kebab-key")).toBe("Some kebab key");
  });

  it("converts a single word", () => {
    expect(toDisplayLabel("energy")).toBe("Energy");
  });

  // --- Edge cases ---
  it("returns empty string for empty input", () => {
    expect(toDisplayLabel("")).toBe("");
  });

  it("never returns a string containing underscores", () => {
    const inputs = [
      "your_targets",
      "cal_day",
      "water_day",
      "current_focus",
      "fat_loss",
      "muscle_gain",
      "general_health",
      "health_markers",
      "some_unknown_key_xyz",
      "activity_level",
      "training_intensity",
      "meal_prep_time",
    ];
    inputs.forEach((key) => {
      const result = toDisplayLabel(key);
      expect(result, `Expected no underscore in toDisplayLabel("${key}") = "${result}"`).not.toContain("_");
    });
  });
});
