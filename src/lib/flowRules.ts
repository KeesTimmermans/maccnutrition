// Signup order: /auth → /pricing → /post-checkout → /onboarding → score offer → /dashboard.

/** Paths reachable without an active subscription or trial. */
export const SUBSCRIPTION_EXEMPT_PATHS = [
  "/.lovable/oauth/consent", "/", "/auth", "/privacy-policy", "/privacy", "/terms",
  "/post-checkout", "/pricing", "/diagnostics", "/reset-password",
];

export const postSignupPath = (): string => "/pricing";

export const postCheckoutPath = (onboardingCompleted: boolean): string =>
  onboardingCompleted ? "/dashboard" : "/onboarding";
