import { describe, it, expect } from "vitest";
import { QUESTIONS, scoreAnswers, compareScores, retakeUnlockAt, daysUntilRetake, bandFor, goalScore, focusTip, FOCUS_TIPS } from "./nutritionScore";

const all = (v: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, v]));

describe("nutritionScore", () => {
  it("all 1s = 0, all 3s = 50, all 5s = 100", () => {
    expect(scoreAnswers(all(1)).total).toBe(0);
    expect(scoreAnswers(all(3)).total).toBe(50);
    expect(scoreAnswers(all(5)).total).toBe(100);
  });
  it("area formula uses its own question count", () => {
    const a = { ...all(5), q7: 1, q8: 2, q9: 3 }; // sum 6, n 3 → (6-3)/12 = 25
    const r = scoreAnswers(a);
    expect(r.areas.whole_foods_sugar).toBe(25);
    expect(r.areas.veg_fruit).toBe(100);
    expect(r.total).toBe(Math.round(((80 - 9) - 16) / 64 * 100));
  });
  it("focus area is lowest, ties go to first in order", () => {
    expect(scoreAnswers(all(3)).focusArea).toBe("veg_fruit");
    expect(scoreAnswers({ ...all(3), q15: 1, q16: 1 }).focusArea).toBe("sleep_stress");
  });
  it("rejects incomplete or out-of-range answers", () => {
    const { q16, ...missing } = all(3);
    expect(() => scoreAnswers(missing)).toThrow();
    expect(() => scoreAnswers({ ...all(3), q1: 6 })).toThrow();
    expect(() => scoreAnswers({ ...all(3), q1: 0 })).toThrow();
  });
  it("bands", () => {
    expect(bandFor(39).id).toBe("getting_started");
    expect(bandFor(40).id).toBe("building");
    expect(bandFor(60).id).toBe("strong");
    expect(bandFor(80).id).toBe("excellent");
  });
  it("compareScores deltas", () => {
    const d = compareScores(scoreAnswers(all(3)), scoreAnswers(all(5)));
    expect(d.overall).toBe(50);
    expect(d.areas.drinks).toBe(50);
  });
  it("retake after 30 days, days never negative", () => {
    const t = new Date("2026-01-01T10:00:00Z");
    expect(retakeUnlockAt(t).toISOString()).toBe("2026-01-31T10:00:00.000Z");
    expect(daysUntilRetake(t, new Date("2026-01-21T10:00:00Z"))).toBe(10);
    expect(daysUntilRetake(t, new Date("2026-03-01T10:00:00Z"))).toBe(0);
  });
  it("goal is score + 5, max 100", () => {
    expect(goalScore(50)).toBe(55);
    expect(goalScore(98)).toBe(100);
  });
  it("tips alternate by result count", () => {
    expect(focusTip("drinks", 1)).toBe(FOCUS_TIPS.drinks[0]);
    expect(focusTip("drinks", 2)).toBe(FOCUS_TIPS.drinks[1]);
    expect(focusTip("drinks", 3)).toBe(FOCUS_TIPS.drinks[0]);
  });
});
