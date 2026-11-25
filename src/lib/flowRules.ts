// Signup order: /auth → /pricing → /post-checkout → /onboarding → score offer → /dashboard.

/** Paths reachable without an active subscription or trial. */
export const SUBSCRIPTION_EXEMPT_PATHS = [
  "/.lovable/oauth/consent", "/", "/auth", "/privacy-policy", "/privacy", "/terms",
  "/post-checkout", "/pricing", "/diagnostics", "/reset-password",
];

export const postSignupPath = (): string => "/pricing";

export const postCheckoutPath = (onboardingCompleted: boolean): string =>
  onboardingCompleted ? "/dashboard" : "/onboarding";

export type AppStateDecision = "loading" | "onboarding" | "dashboard";

/** Signed-in, subscribed user on "/": the onboarding flag decides, not whether a baseline row exists. */
export const appStateFor = (onboardingCompleted: boolean | null): AppStateDecision =>
  onboardingCompleted === null ? "loading" : onboardingCompleted ? "dashboard" : "onboarding";

export type LandingView = "landing" | "landing_no_plan" | "app";

/** "/" view: signed-out visitors and signed-in users without a plan see the landing page; subscribed users get the app. */
export const landingViewFor = (signedIn: boolean, hasPlan: boolean): LandingView =>
  !signedIn ? "landing" : hasPlan ? "app" : "landing_no_plan";
