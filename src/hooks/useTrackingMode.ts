import { createContext, useContext } from "react";
import type { TrackingMode } from "@/lib/trackingMode";

export interface UseTrackingModeResult {
  mode: TrackingMode;
  isHabitMode: boolean;
  /** True until the saved mode is known — wait for it before branching UI on `mode`. */
  loading: boolean;
  /** Updates every screen immediately, then saves; reverts and rethrows if the save fails. */
  setMode: (mode: TrackingMode) => Promise<void>;
}

export const TrackingModeContext = createContext<UseTrackingModeResult | null>(null);

/**
 * The user's food approach: calorie tracking or simple habits.
 * Loaded once by TrackingModeProvider and shared, so switching is instant everywhere.
 * Changing it never recalculates nutrition targets.
 */
export const useTrackingMode = (): UseTrackingModeResult => {
  const ctx = useContext(TrackingModeContext);
  if (!ctx) throw new Error("useTrackingMode must be used within TrackingModeProvider");
  return ctx;
};
