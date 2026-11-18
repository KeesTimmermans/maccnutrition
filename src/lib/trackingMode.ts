export type TrackingMode = "calories" | "habits";

/** Anything missing or unknown counts as calorie tracking (the original behaviour). */
export const normalizeTrackingMode = (value: unknown): TrackingMode =>
  value === "habits" ? "habits" : "calories";
