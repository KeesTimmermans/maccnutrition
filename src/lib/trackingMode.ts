export type TrackingMode = "calories" | "habits";

/** Anything missing or unknown counts as calorie tracking (the original behaviour). */
export const normalizeTrackingMode = (value: unknown): TrackingMode =>
  value === "habits" ? "habits" : "calories";

/**
 * Whether calorie/macro numbers may be shown: only once the saved mode is known
 * and it is calorie tracking, so a habits user never sees a flash of numbers.
 */
export const showNumbers = (mode: TrackingMode, loading: boolean): boolean =>
  !loading && mode !== "habits";
