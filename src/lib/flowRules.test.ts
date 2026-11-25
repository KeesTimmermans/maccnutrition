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

import { landingViewFor } from "./flowRules";
describe("landingViewFor", () => {
  it("signed-out visitors see the landing page", () => expect(landingViewFor(false, false)).toBe("landing"));
  it("signed-in users without a plan get the app, not the landing page", () => expect(landingViewFor(true, false)).toBe("app"));
  it("subscribed users get the app", () => expect(landingViewFor(true, true)).toBe("app"));
});

import { indexViewFor } from "./flowRules";
describe("indexViewFor", () => {
  it("signed-out visitors see the landing page", () =>
    expect(indexViewFor({ signedIn: false, checked: false, error: false, hasPlan: false })).toBe("landing"));
  it("signed in, check not finished and no error = loading", () =>
    expect(indexViewFor({ signedIn: true, checked: false, error: false, hasPlan: false })).toBe("loading"));
  it("signed in, checked, no error, no plan or trial = pricing", () =>
    expect(indexViewFor({ signedIn: true, checked: true, error: false, hasPlan: false })).toBe("pricing"));
  it("signed in, error, no plan = account_error (never pricing or landing)", () =>
    expect(indexViewFor({ signedIn: true, checked: true, error: true, hasPlan: false })).toBe("account_error"));
  it("signed in, error before the check finished = account_error", () =>
    expect(indexViewFor({ signedIn: true, checked: false, error: true, hasPlan: false })).toBe("account_error"));
  it("signed in with a plan or trial = app", () =>
    expect(indexViewFor({ signedIn: true, checked: true, error: false, hasPlan: true })).toBe("app"));
  it("signed in with a plan stays in the app even after an error", () =>
    expect(indexViewFor({ signedIn: true, checked: true, error: true, hasPlan: true })).toBe("app"));
});
