import { describe, it, expect } from "vitest";
import { postSignupPath, postCheckoutPath, SUBSCRIPTION_EXEMPT_PATHS } from "./flowRules";

describe("flowRules", () => {
  it("sends new sign-ups to pricing", () => {
    expect(postSignupPath()).toBe("/pricing");
  });
  it("sends paid users to onboarding until it is complete", () => {
    expect(postCheckoutPath(false)).toBe("/onboarding");
    expect(postCheckoutPath(true)).toBe("/dashboard");
  });
  it("only exempts pricing, not onboarding or the score", () => {
    expect(SUBSCRIPTION_EXEMPT_PATHS).toContain("/pricing");
    expect(SUBSCRIPTION_EXEMPT_PATHS).not.toContain("/onboarding");
    expect(SUBSCRIPTION_EXEMPT_PATHS).not.toContain("/nutrition-score");
  });
});

import { appStateFor } from "./flowRules";
describe("appStateFor", () => {
  it("shows the dashboard when onboarding is complete", () => expect(appStateFor(true)).toBe("dashboard"));
  it("sends to onboarding when not complete (partial baseline row)", () => expect(appStateFor(false)).toBe("onboarding"));
  it("keeps loading while the flag is unknown", () => expect(appStateFor(null)).toBe("loading"));
});
