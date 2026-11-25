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

/**
 * Scan & rate result. Only the barcode's first 3 digits (the GS1 country
 * prefix) are sent — never the full barcode or the product.
 */
export const trackProductScored = (props: {
  found: boolean;
  confidence: string | null;
  provisional: boolean | null;
  score: number | null;
  barcodePrefix: string;
}) =>
  track("product_scored", {
    found: props.found,
    confidence: props.confidence,
    provisional: props.provisional,
    score: props.score,
    barcode_prefix: props.barcodePrefix.slice(0, 3),
  });

/** Scan & rate "Better options" shown. Counts and the store/category only. */
export const trackAlternativesShown = (props: {
  count: number;
  inStoreCount: number;
  hadStore: boolean;
  store: string | null;
  sourceCategory: string | null;
  candidateCount: number;
  tier: 1 | 2 | null;
  scoredCount: number;
  scannedScore: number;
  source: string | null;
}) =>
  track("alternatives_shown", {
    candidate_count: props.candidateCount,
    tier: props.tier,
    scored_count: props.scoredCount,
    scanned_score: props.scannedScore,
    response_source: props.source,
    count: props.count,
    in_store_count: props.inStoreCount,
    had_store: props.hadStore,
    store: props.store,
    source_category: props.sourceCategory,
  });
