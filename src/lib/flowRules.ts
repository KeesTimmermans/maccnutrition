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

export type IndexView = "landing" | "loading" | "pricing" | "account_error" | "app";

/** "/" view: a signed-in user never sees the landing page — a failed check shows a retry screen, never /pricing. */
export const indexViewFor = (input: {
  signedIn: boolean;
  checked: boolean;
  error: boolean;
  hasPlan: boolean;
}): IndexView => {
  if (!input.signedIn) return "landing";
  if (input.hasPlan) return "app";
  if (input.error) return "account_error";
  if (!input.checked) return "loading";
  return "pricing";
};
