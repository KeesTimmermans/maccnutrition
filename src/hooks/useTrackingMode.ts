import { useCallback, useEffect, useState } from "react";
import { getUserBaseline, updateUserSettings } from "@/lib/userService";
import { normalizeTrackingMode, type TrackingMode } from "@/lib/trackingMode";

export interface UseTrackingModeResult {
  mode: TrackingMode;
  isHabitMode: boolean;
  /** True until the saved mode is known — wait for it before branching UI on `mode`. */
  loading: boolean;
  setMode: (mode: TrackingMode) => Promise<void>;
}

/**
 * The user's food approach: calorie tracking or simple habits.
 * Changing it never recalculates nutrition targets.
 */
export const useTrackingMode = (): UseTrackingModeResult => {
  const [mode, setModeState] = useState<TrackingMode>("calories");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const baseline = await getUserBaseline();
      setModeState(normalizeTrackingMode(baseline?.tracking_mode));
    } catch (error) {
      console.error("Error loading tracking mode:", error);
      setModeState("calories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setMode = useCallback(
    async (next: TrackingMode) => {
      await updateUserSettings({ tracking_mode: next });
      await refresh();
    },
    [refresh],
  );

  return { mode, isHabitMode: mode === "habits", loading, setMode };
};
