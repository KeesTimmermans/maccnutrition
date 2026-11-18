import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { updateUserSettings } from "@/lib/userService";
import { normalizeTrackingMode, type TrackingMode } from "@/lib/trackingMode";
import { TrackingModeContext, type UseTrackingModeResult } from "@/hooks/useTrackingMode";

interface TrackingModeProviderProps {
  children: ReactNode;
  /** When this changes (e.g. onboarding just finished), the saved mode is read again. */
  reloadKey?: unknown;
}

/** Loads the signed-in user's food approach once and shares it with every screen. */
export const TrackingModeProvider = ({ children, reloadKey }: TrackingModeProviderProps) => {
  // undefined = session not known yet, null = signed out
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [mode, setModeState] = useState<TrackingMode>("calories");
  const [loading, setLoading] = useState(true);
  const modeRef = useRef<TrackingMode>("calories");
  const loadedForRef = useRef<string | null>(null);
  const requestRef = useRef(0);

  const applyMode = useCallback((next: TrackingMode) => {
    modeRef.current = next;
    setModeState(next);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) {
      loadedForRef.current = null;
      applyMode("calories");
      setLoading(false);
      return;
    }

    // Only hide numbers again when a different user signs in; a re-read for the same user keeps the known mode.
    if (loadedForRef.current !== userId) setLoading(true);
    const request = ++requestRef.current;

    supabase
      .from("user_baselines")
      .select("tracking_mode")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (request !== requestRef.current) return;
        if (error) console.error("Error loading tracking mode:", error);
        applyMode(normalizeTrackingMode(data?.tracking_mode));
        loadedForRef.current = userId;
        setLoading(false);
      });
  }, [userId, reloadKey, applyMode]);

  const setMode = useCallback(
    async (next: TrackingMode) => {
      const previous = modeRef.current;
      requestRef.current++; // a slower in-flight read must not overwrite the user's choice
      applyMode(next);
      setLoading(false);
      try {
        await updateUserSettings({ tracking_mode: next });
      } catch (error) {
        applyMode(previous);
        throw error;
      }
    },
    [applyMode],
  );

  const value = useMemo<UseTrackingModeResult>(
    () => ({ mode, isHabitMode: mode === "habits", loading, setMode }),
    [mode, loading, setMode],
  );

  return <TrackingModeContext.Provider value={value}>{children}</TrackingModeContext.Provider>;
};
