import { track } from "@/analytics/posthog";

export const events = {
  signupStarted: () => track("signup_started"),
  signupCompleted: () => track("signup_completed"),
  onboardingCompleted: () => track("onboarding_completed"),
  paywallViewed: (placement: "settings" | "onboarding" | "feature_gate") =>
    track("paywall_viewed", { placement }),
  trialStarted: (plan: "monthly" | "annual") =>
    track("trial_started", { plan }),
  subscribed: (plan: "monthly" | "annual") =>
    track("subscribed", { plan }),
  subscriptionCanceled: (plan: "monthly" | "annual") =>
    track("subscription_canceled", { plan }),
  mealLogged: (method: "barcode" | "photo" | "text") =>
    track("meal_logged", { method }),
  waterLogged: () => track("water_logged"),
  dailyCheckinCompleted: () => track("daily_checkin_completed"),
  streakMilestone: (days: 3 | 7 | 14 | 30 | 60 | 90) =>
    track("streak_milestone", { days }),
} as const;
