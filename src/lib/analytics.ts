/**
 * PostHog analytics — consent-gated, PII-safe.
 *
 * Rules:
 *  - Never send food names, macros, body metrics, or any health data.
 *  - Only track event names + safe structural properties (source, method, etc.).
 *  - PostHog is NOT loaded until the user opts-in via analytics_consent.
 *  - Calling track/identify before init is a no-op (safe).
 */

import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

let _initialised = false;

/** Returns true only when PostHog has been initialised for this session. */
export const isAnalyticsReady = () => _initialised;

/**
 * Initialise PostHog.  Must only be called when the user has given consent.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export const initAnalytics = () => {
  if (_initialised) return;
  if (!POSTHOG_KEY || !POSTHOG_HOST) {
    // Keys not configured — silently skip (e.g. dev without .env values)
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // No autocapture — we send only what we explicitly track
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage",
    // Do not send IP for GDPR compliance
    ip: false,
    loaded: (ph) => {
      // Opt out of PostHog's own feature-flag polling to minimise network noise
      ph.featureFlags.override({});
    },
  });

  _initialised = true;
};

/** Identify a logged-in user.  Only userId is sent — no email or PII. */
export const identifyUser = (userId: string) => {
  if (!_initialised) return;
  posthog.identify(userId);
};

/** Reset PostHog on logout so the next session starts fresh. */
export const resetAnalytics = () => {
  if (!_initialised) return;
  posthog.reset();
};

/** Shut down analytics (user revokes consent). */
export const shutdownAnalytics = () => {
  if (!_initialised) return;
  posthog.opt_out_capturing();
  _initialised = false;
};

type SafeProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Track a product event.
 * Properties must NEVER contain food names, macros, or body metrics.
 */
export const track = (event: string, properties?: SafeProperties) => {
  if (!_initialised) return;
  posthog.capture(event, properties);
};

// ─── Typed event helpers ────────────────────────────────────────────────────

export const trackSignedUp = () => track("signed_up");

export const trackTrialStarted = () => track("trial_started");

/** source: "barcode" | "photo" | "text" | "upload" | "favorite" | "search" */
export const trackMealLogged = (source: string) => track("meal_logged", { source });

export const trackWaterLogged = () => track("water_logged");

export const trackCheckinCompleted = () => track("checkin_completed");

export const trackSubscribed = () => track("subscribed");
