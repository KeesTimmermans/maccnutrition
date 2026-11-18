import { describe, it, expect } from "vitest";
import {
  validateChecklistItem,
  FALLBACK_LIBRARY,
  CHECKLIST_CATEGORIES,
  EXERCISE_ACTION_PATTERN,
  applyTrainingNutritionRule,
  trainingNutritionFallback,
  hasTrainingDays,
  isTrainingNutritionTitle,
  pickFallbacks,
  applyCategoryMix,
  deterministicItems,
  classifyCategory,
  isExerciseItem,
  isStaleChecklist,
  weakestArea,
  CHECKLIST_SIZE,
} from "../../supabase/functions/_shared/checklistRules";

const item = (over: Record<string, unknown> = {}) => ({
  title: "Screens off 30 minutes before bed",
  why: "Helps you fall asleep sooner.",
  when: "evening",
  kind: "manual",
  category: "sleep",
  ...over,
});

describe("validateChecklistItem", () => {
  it.each([
    "Focus on protein at every meal",
    "Try to drink more water today",
    "Optimise your sleep routine tonight",
    "Be mindful of portion sizes today",
    "Ensure you eat enough vegetables",
    "Consider a glass of water after lunch",
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
    expect(validateChecklistItem(item({ title: "Get 30 g protein at breakfast", category: "nutrition" }), "calories").valid).toBe(true);
    expect(validateChecklistItem(item({ title: "Keep lunch under 500 kcal today", category: "nutrition" }), "calories").valid).toBe(false);
  });

  it("rejects bad enums and rules", () => {
    expect(validateChecklistItem(item({ when: "midnight" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "magic" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "auto" }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "auto", rule: { type: "meal_logged", meal: "brunch" } }), "calories").valid).toBe(false);
    expect(validateChecklistItem(item({ kind: "manual", rule: { type: "water_goal" } }), "calories").valid).toBe(false);
    expect(
      validateChecklistItem(item({ title: "Log your lunch in the app", kind: "auto", category: "nutrition", rule: { type: "protein_by_hour", grams: 30, hour: 10 } }), "habits").valid,
    ).toBe(false);
    expect(
      validateChecklistItem(item({ title: "Log your lunch in the app", kind: "auto", category: "nutrition", rule: { type: "meal_logged", meal: "lunch" } }), "habits").valid,
    ).toBe(true);
  });

  it("rejects a missing or invalid category", () => {
    expect(validateChecklistItem(item({ category: undefined }), "habits").valid).toBe(false);
    expect(validateChecklistItem(item({ category: "fitness" }), "habits").valid).toBe(false);
  });

  it.each([
    "Do three sets of squats tonight",
    "Take a walk and stretch tonight",
    "Go for a 20-minute run before work",
    "Hit the gym after work today",
    "Add one extra set to your first lift",
  ])("rejects exercise: %s", (title) => {
    expect(validateChecklistItem(item({ title, category: "stress" }), "calories").valid).toBe(false);
  });

  it("rejects exercise wording in the why line too", () => {
    expect(validateChecklistItem(item({ why: "Sets you up for a good workout." }), "calories").valid).toBe(false);
  });

  it("allows eating or drinking around training", () => {
    expect(
      validateChecklistItem(item({ title: "Eat a banana and drink water an hour before you train", category: "nutrition", when: "afternoon" }), "calories").valid,
    ).toBe(true);
    expect(isExerciseItem("Have oats before your training session")).toBe(false);
    expect(isExerciseItem("Do three sets before bed")).toBe(true);
  });

  it.each([
    "Do three sets of squats",
    "Take a walk and stretch after dinner",
    "Go for a run after lunch",
    "Finish your workout before breakfast",
    "Hit the gym after lunch",
  ])("rejects asking the user to exercise: %s", (title) => {
    expect(isExerciseItem(title)).toBe(true);
    expect(validateChecklistItem(item({ title, category: "nutrition" }), "habits").valid).toBe(false);
  });

  it.each([
    "Eat a piece of fruit 60–90 minutes pre-workout",
    "Sip water steadily before and during training",
    "Have a palm of protein within two hours after your workout",
    "Eat a banana an hour before your run",
    "Eat a palm of protein at lunch",
  ])("accepts nutrition and hydration around training: %s", (title) => {
    expect(isExerciseItem(title)).toBe(false);
    expect(validateChecklistItem(item({ title, category: "nutrition", when: "anytime" }), "habits")).toEqual({ valid: true });
  });

  it("rejects a training word without any eating or drinking word, and exercise actions in the why line", () => {
    expect(isExerciseItem("Get to bed early before your training day")).toBe(true);
    expect(isExerciseItem("Go to bed at the same time", "Helps your next session.")).toBe(true);
    expect(isExerciseItem("Eat a palm of protein at lunch", "Then take a short walk.")).toBe(true);
    expect(isExerciseItem("Eat a palm of protein at lunch", "Helps you recover from training.")).toBe(false);
  });

  it("treats time ranges as fine in habits mode but still rejects nutrient grams", () => {
    expect(
      validateChecklistItem(item({ title: "If you train today: eat a piece of fruit 60–90 minutes before", category: "nutrition", when: "anytime" }), "habits"),
    ).toEqual({ valid: true });
    expect(
      validateChecklistItem(item({ title: "If you train today: eat 30g protein within two hours after", category: "nutrition", when: "anytime" }), "habits").valid,
    ).toBe(false);
  });
});

describe("training nutrition", () => {
  it.each(["habits", "calories"] as const)("has 3 training-nutrition fallbacks in %s mode that validate and are never picked as general fallbacks", (mode) => {
    const training = FALLBACK_LIBRARY[mode].filter((e) => e.trainingOnly);
    expect(training).toHaveLength(3);
    for (const e of training) {
      expect(isTrainingNutritionTitle(e.title)).toBe(true);
      expect(["nutrition", "hydration"]).toContain(e.category);
      expect(validateChecklistItem(e, "habits"), e.title).toEqual({ valid: true });
      expect(validateChecklistItem(e, "calories"), e.title).toEqual({ valid: true });
    }
    for (let n = 1; n <= 6; n += 1) {
      expect(pickFallbacks(mode, n, {}).some((p) => isTrainingNutritionTitle(p.title))).toBe(false);
    }
  });

  it("knows when a profile has training days", () => {
    expect(hasTrainingDays(3)).toBe(true);
    expect(hasTrainingDays("2")).toBe(true);
    expect(hasTrainingDays(0)).toBe(false);
    expect(hasTrainingDays(null)).toBe(false);
    expect(hasTrainingDays(undefined)).toBe(false);
  });

  const ai = (id: string, title: string, category: "nutrition" | "sleep" | "stress" | "hydration") => ({
    id, title, when: "anytime" as const, kind: "manual" as const, source: "ai" as const, category,
  });

  it("adds exactly one training item for users with training days, making room without dropping the calm item", () => {
    const items = [
      ai("ai-1", "Add a handful of vegetables to lunch", "nutrition"),
      ai("ai-2", "Screens off 30 minutes before bed", "sleep"),
    ];
    const out = applyTrainingNutritionRule(items, { mode: "calories", needed: 2, hasTraining: true });
    expect(out).toHaveLength(2);
    expect(out.filter((i) => isTrainingNutritionTitle(i.title))).toHaveLength(1);
    expect(out.some((i) => i.category === "sleep")).toBe(true);
  });

  it("keeps the AI's training item, drops extra ones, and removes them all without training days", () => {
    const items = [
      ai("ai-1", "Si vous vous entraînez : mangez un fruit avant", "nutrition"),
      ai("ai-2", "If you train today: drink water before and after", "hydration"),
      ai("ai-3", "Screens off 30 minutes before bed", "sleep"),
    ];
    const flagged = (i: { id: string }) => i.id === "ai-1";
    const withTraining = applyTrainingNutritionRule(items, { mode: "habits", needed: 4, hasTraining: true, isTraining: flagged });
    expect(withTraining.map((i) => i.id).sort()).toEqual(["ai-1", "ai-3"]);
    const without = applyTrainingNutritionRule(items, { mode: "habits", needed: 4, hasTraining: false, isTraining: flagged });
    expect(without.map((i) => i.id)).toEqual(["ai-3"]);
  });

  it("uses a hydration fallback when habits-mode nutrition is already full", () => {
    const chosen = [{ category: "nutrition" as const }, { category: "nutrition" as const }, { category: "nutrition" as const }];
    expect(trainingNutritionFallback("habits", [], chosen)?.category).toBe("hydration");
    const out = applyTrainingNutritionRule([], { mode: "habits", needed: 4, hasTraining: true });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("fallback");
  });
});

describe("fallback library", () => {
  it.each(["habits", "calories"] as const)("has at least 4 valid items per category in %s mode, none about exercise", (mode) => {
    for (const category of CHECKLIST_CATEGORIES) {
      expect(FALLBACK_LIBRARY[mode].filter((e) => e.category === category).length, category).toBeGreaterThanOrEqual(4);
    }
    for (const entry of FALLBACK_LIBRARY[mode]) {
      const res = validateChecklistItem(entry, mode);
      expect(res, `${entry.title}: ${res.reason}`).toEqual({ valid: true });
      expect(isExerciseItem(entry.title, entry.why), entry.title).toBe(false);
      expect(EXERCISE_ACTION_PATTERN.test(entry.title) || EXERCISE_ACTION_PATTERN.test(entry.why), entry.title).toBe(false);
      expect(/\bwalk/i.test(entry.title), entry.title).toBe(false);
    }
  });

  it("picks the requested number without duplicates of existing titles", () => {
    const picked = pickFallbacks("habits", 4, {}, ["Prep tomorrow's lunch tonight"]);
    expect(picked).toHaveLength(4);
    expect(picked.map((p) => p.title)).not.toContain("Prep tomorrow's lunch tonight");
    expect(new Set(picked.map((p) => p.id)).size).toBe(4);
    expect(picked.every((p) => p.source === "fallback")).toBe(true);
  });

  it.each(["habits", "calories"] as const)("always includes a sleep or stress item and spreads categories (%s)", (mode) => {
    for (let n = 1; n <= 5; n += 1) {
      const picked = pickFallbacks(mode, n, {});
      expect(picked.some((p) => p.category === "sleep" || p.category === "stress")).toBe(true);
    }
    expect(new Set(pickFallbacks(mode, 4, {}).map((p) => p.category)).size).toBe(4);
  });

  it("caps nutrition at 3 in habits mode, counting AI items already chosen", () => {
    const chosen = [{ category: "nutrition" as const }, { category: "nutrition" as const }, { category: "nutrition" as const }];
    const picked = pickFallbacks("habits", 5, {}, [], { chosen });
    expect(picked.filter((p) => p.category === "nutrition")).toHaveLength(0);
  });

  it("prefers the weakest area", () => {
    expect(pickFallbacks("calories", 1, {}, [], { preferCalm: "stress", prefer: "stress" })[0].category).toBe("stress");
    const two = pickFallbacks("habits", 2, {}, [], { prefer: "hydration" }).map((p) => p.category);
    expect(two).toContain("hydration");
  });

  it("skips items that clash with a vegan diet", () => {
    const picked = pickFallbacks("habits", 20, { dietType: "vegan" });
    expect(picked.some((p) => /eggs|yoghurt/i.test(p.title))).toBe(false);
  });
});

describe("category mix on AI items", () => {
  const ai = (...cats: ("nutrition" | "sleep" | "stress" | "hydration")[]) => cats.map((category, i) => ({ id: `ai-${i}`, category }));

  it("keeps at most 3 nutrition items in habits mode", () => {
    const kept = applyCategoryMix(ai("nutrition", "nutrition", "nutrition", "nutrition", "sleep"), "habits", 4);
    expect(kept.filter((k) => k.category === "nutrition")).toHaveLength(3);
    expect(kept.some((k) => k.category === "sleep")).toBe(true);
  });

  it("frees a slot when no sleep or stress item is present", () => {
    expect(applyCategoryMix(ai("nutrition", "hydration"), "calories", 2).map((k) => k.category)).toEqual(["hydration"]);
    expect(applyCategoryMix(ai("nutrition", "stress"), "calories", 2)).toHaveLength(2);
  });
});

describe("categories", () => {
  it.each([
    ["Screens off 30 minutes before bed", "sleep"],
    ["No caffeine after 2pm today", "sleep"],
    ["Eat lunch away from your screen", "stress"],
    ["Take five slow breaths before your first meal", "stress"],
    ["Finish a full bottle of water by 3pm", "hydration"],
    ["A palm of protein at breakfast", "nutrition"],
  ])("classifies %s as %s", (text, category) => {
    expect(classifyCategory(text)).toBe(category);
  });

  it("treats saved lists without categories as stale", () => {
    expect(isStaleChecklist([{ id: "water", title: "x" }])).toBe(true);
    expect(isStaleChecklist([{ id: "water", title: "x", category: "hydration" }])).toBe(false);
  });

  it("reads the weakest area from the check-in", () => {
    expect(weakestArea({ sleep_quality: 1, stress_level: 2, energy_level: 3 })).toBe("sleep");
    expect(weakestArea({ sleep_quality: 4, stress_level: 5, energy_level: 3 })).toBe("stress");
    expect(weakestArea({ sleep_quality: 4, stress_level: 2, energy_level: 1 })).toBe("hydration");
    expect(weakestArea({ sleep_quality: 4, stress_level: 2, energy_level: 4 })).toBeNull();
    expect(weakestArea(null)).toBeNull();
  });

  it("deterministic items: water is hydration; the weekly habit keeps or derives its category and is never a workout", () => {
    expect(deterministicItems(null)).toMatchObject([{ id: "water", category: "hydration" }]);
    expect(deterministicItems({ habit_title: "A palm of protein at breakfast", habit_description: "Every day.", category: "nutrition" })[1].category).toBe("nutrition");
    expect(deterministicItems({ habit_title: "Same bedtime every night", habit_description: "Within half an hour.", category: null })[1].category).toBe("sleep");
    expect(deterministicItems({ habit_title: "Do 20 squats every morning", habit_description: "Build the habit." }).map((i) => i.id)).toEqual(["water"]);
    expect(CHECKLIST_SIZE).toEqual({ habits: 6, calories: 4 });
  });
});
