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

export type LandingView = "landing" | "app";

/** "/" view: the landing page is for signed-out visitors only; signed-in users get the app (the subscription gate sends planless users to /pricing). */
export const landingViewFor = (signedIn: boolean, _hasPlan: boolean): LandingView =>
  signedIn ? "app" : "landing";
