import { describe, it, expect } from "vitest";
import {
  validateChecklistItem,
  FALLBACK_LIBRARY,
  pickFallbacks,
  deterministicItems,
  CHECKLIST_SIZE,
} from "../../supabase/functions/_shared/checklistRules";

const item = (over: Record<string, unknown> = {}) => ({
  title: "Take a 10-minute walk after dinner",
  why: "Helps digestion.",
  when: "evening",
  kind: "manual",
  ...over,
});

describe("validateChecklistItem", () => {
  it.each([
    "Focus on protein at every meal",
    "Try to drink more water today",
    "Optimise your sleep routine tonight",
    "Be mindful of portion sizes today",
    "Ensure you eat enough vegetables",
    "Consider a walk after lunch today",
  ])("rejects vague title: %s", (title) => {
    expect(validateChecklistItem(item({ title }), "calories").valid).toBe(false);
  });

  it("rejects titles under 4 words", () => {
    expect(validateChecklistItem(item({ title: "Drink water" }), "habits").valid).toBe(false);
  });

  it.each([
    "Breakfast: a palm of protein (eggs or Greek yoghurt) plus one fruit",
    "Prep tomorrow's lunch tonight",
    "Screens off 30 minutes before bed",
  ])("accepts concrete title: %s", (title) => {
    expect(validateChecklistItem(item({ title }), "habits").valid).toBe(true);
  });

  it("rejects nutrition numbers in habits mode (title or why)", () => {
    expect(validateChecklistItem(item({ title: "Eat 30g protein at breakfast today" }), "habits").valid).toBe(false);
    expect(validateChecklistItem(item({ why: "Keeps you under your calorie target." }), "habits").valid).toBe(false);
  });

  it("allows the protein target in calories mode but not invented calories", () => {
    expect(validateChecklistItem(item({ title: "Get 30 g protein at breakfast" }), "calories").valid).toBe(true);
    expect(validateChecklistItem(item({ title: "Keep lunch under 500 kcal today" }), "calories").valid).toBe(false);
  });

  it("rejects bad enums and rules", () => {
    expect(validateChecklistItem(item({ when: "midnight" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "magic" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "auto" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "auto", rule: { type: "meal_logged", meal: "brunch" } }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "manual", rule: { type: "water_goal" } }), "calories").valid).toBe(false);
    expect(
      validateChecklistItem(item({ title: "Log your lunch in the app", kind: "auto", rule: { type: "protein_by_hour", grams: 30, hour: 10 } }), "habits").valid,
    ).toBe(false);
    expect(
      validateChecklistItem(item({ title: "Log your lunch in the app", kind: "auto", rule: { type: "meal_logged", meal: "lunch" } }), "habits").valid,
    ).toBe(true);
  });
});

describe("fallback library", () => {
  it.each(["habits", "calories"] as const)("has at least 12 valid items for %s mode", (mode) => {
    expect(FALLBACK_LIBRARY[mode].length).toBeGreaterThanOrEqual(12);
    for (const entry of FALLBACK_LIBRARY[mode]) {
      const res = validateChecklistItem(entry, mode);
      expect(res, `${entry.title}: ${res.reason}`).toEqual({ valid: true });
    }
  });

  it("picks the requested number without duplicates of existing titles", () => {
    const picked = pickFallbacks("habits", 4, {}, ["Prep tomorrow's lunch tonight"]);
    expect(picked).toHaveLength(4);
    expect(picked.map((p) => p.title)).not.toContain("Prep tomorrow's lunch tonight");
    expect(new Set(picked.map((p) => p.id)).size).toBe(4);
    expect(picked.every((p) => p.source === "fallback")).toBe(true);
  });

  it("skips items that clash with a vegan diet", () => {
    const picked = pickFallbacks("habits", 13, { dietType: "vegan" });
    expect(picked.some((p) => /eggs|yoghurt/i.test(p.title))).toBe(false);
  });

  it("deterministic items: water always, weekly habit when there is one", () => {
    expect(deterministicItems(null).map((i) => i.id)).toEqual(["water"]);
    const withHabit = deterministicItems({ habit_title: "A palm of protein at breakfast", habit_description: "Every day." });
    expect(withHabit.map((i) => i.kind)).toEqual(["auto", "habit"]);
    expect(CHECKLIST_SIZE).toEqual({ habits: 6, calories: 4 });
  });
});
