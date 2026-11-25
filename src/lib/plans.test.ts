import { describe, it, expect } from "vitest";
import {
  TRIAL_DAYS, PLANS, planFromInterval, parsePlan, yearlyPerMonthPence,
  yearlySavingPence, yearlySavingPercent, formatGbp,
} from "../../supabase/functions/_shared/plans";

describe("plans", () => {
  it("trial is 14 days", () => expect(TRIAL_DAYS).toBe(14));
  it("prices", () => { expect(PLANS.monthly.pence).toBe(999); expect(PLANS.yearly.pence).toBe(8999); });
  it("yearly per month is 750p", () => expect(yearlyPerMonthPence()).toBe(750));
  it("yearly saving is 2989p", () => expect(yearlySavingPence()).toBe(2989));
  it("yearly saving is 25%", () => expect(yearlySavingPercent()).toBe(25));
  it("formatGbp", () => { expect(formatGbp(8999)).toBe("£89.99"); expect(formatGbp(750)).toBe("£7.50"); expect(formatGbp(2989)).toBe("£29.89"); });
  it("planFromInterval", () => {
    expect(planFromInterval("month")).toBe("monthly");
    expect(planFromInterval("year")).toBe("yearly");
    expect(planFromInterval("week")).toBeNull();
    expect(planFromInterval(null)).toBeNull();
  });
  it("parsePlan defaults to monthly and rejects others", () => {
    expect(parsePlan(undefined)).toEqual({ ok: true, plan: "monthly" });
    expect(parsePlan("yearly")).toEqual({ ok: true, plan: "yearly" });
    expect(parsePlan("monthly")).toEqual({ ok: true, plan: "monthly" });
    expect(parsePlan("lifetime").ok).toBe(false);
    expect(parsePlan(12).ok).toBe(false);
  });
});
