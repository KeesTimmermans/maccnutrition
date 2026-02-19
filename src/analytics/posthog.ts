/**
 * PostHog analytics — GDPR opt-in, PII-safe, UK nutrition app.
 *
 * Rules:
 *  - Opt-out by default; only captures after explicit user consent.
 *  - Never sends food names, macros, calories, weight, notes, or free text.
 *  - Only allowlisted events are sent; everything else is dropped.
 *  - User identity is Supabase UUID only — no email or PII.
 */

import posthog from "posthog-js";

// ─── Configuration ──────────────────────────────────────────────────────────

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

const CONSENT_STORAGE_KEY = "analytics_consent_v1";

const ALLOWED_EVENTS = new Set([
  "signup_started",
  "signup_completed",
  "onboarding_completed",
  "paywall_viewed",
  "trial_started",
  "subscribed",
  "subscription_canceled",
  "meal_logged",
  "water_logged",
  "daily_checkin_completed",
  "streak_milestone",
]);

const SAFE_PROPERTIES = new Set(["method", "days", "plan", "placement"]);

// ─── State ──────────────────────────────────────────────────────────────────

let _initialised = false;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip query string and hash from a URL string. */
function stripUrlParams(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

/** Keep only safe properties from an event payload. */
function sanitiseProperties(props: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key === "$current_url" && typeof props[key] === "string") {
      clean[key] = stripUrlParams(props[key] as string);
    } else if (SAFE_PROPERTIES.has(key)) {
      clean[key] = props[key];
    }
    // All other properties are dropped
  }
  return clean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialise PostHog. Safe to call multiple times — subsequent calls are no-ops.
 * Capturing is opted-out by default; call `setConsent(true)` to enable.
 */
export function initPostHog(): void {
  if (_initialised) return;
  if (!POSTHOG_KEY || !POSTHOG_HOST) return; // keys not configured

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    opt_out_capturing_by_default: true,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage",
    ip: false, // GDPR — do not resolve IP
    before_send: (event) => {
      if (!event) return null;

      // Drop events not in the allowlist
      const name = event.event;
      if (!name || !ALLOWED_EVENTS.has(name)) return null;

      // Sanitise properties
      if (event.properties) {
        event.properties = sanitiseProperties(event.properties);
      }

      // Clear any $set / $set_once to prevent PII leaking
      if ("$set" in event) (event as unknown as Record<string, unknown>)["$set"] = undefined;
      if ("$set_once" in event) (event as unknown as Record<string, unknown>)["$set_once"] = undefined;

      return event;
    },
  });

  _initialised = true;

  // Restore consent from storage
  const stored = getConsent();
  if (stored === "granted") {
    posthog.opt_in_capturing();
  }
}

/** Read the current consent state. */
export function getConsent(): "unset" | "granted" | "denied" {
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {
    // localStorage unavailable
  }
  return "unset";
}

/** Set consent. `true` = granted, `false` = denied. */
export function setConsent(value: boolean): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value ? "granted" : "denied");
  } catch {
    // localStorage unavailable
  }

  if (!_initialised) return;

  if (value) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

/** Identify a logged-in user by Supabase UUID only — no email or PII. */
export function identifyUser(userId: string): void {
  if (!_initialised) return;
  posthog.identify(userId);
}

/** Reset identity on logout so the next session starts fresh. */
export function resetUser(): void {
  if (!_initialised) return;
  posthog.reset();
}

type SafeProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Track a product event. Only allowlisted events will be sent.
 * Properties must NEVER contain food names, macros, or body metrics.
 */
export function track(event: string, properties?: SafeProps): void {
  if (!_initialised) return;
  posthog.capture(event, properties);
}
