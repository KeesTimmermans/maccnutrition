import { describe, it, expect } from "vitest";
import { normalizeTrackingMode } from "@/lib/trackingMode";

describe("normalizeTrackingMode", () => {
  it("treats missing values as calories", () => {
    expect(normalizeTrackingMode(null)).toBe("calories");
    expect(normalizeTrackingMode(undefined)).toBe("calories");
  });
  it("keeps the two real modes", () => {
    expect(normalizeTrackingMode("habits")).toBe("habits");
    expect(normalizeTrackingMode("calories")).toBe("calories");
  });
  it("treats unknown values as calories", () => {
    expect(normalizeTrackingMode("garbage")).toBe("calories");
    expect(normalizeTrackingMode("Habits")).toBe("calories");
    expect(normalizeTrackingMode("")).toBe("calories");
    expect(normalizeTrackingMode(42)).toBe("calories");
  });
});
