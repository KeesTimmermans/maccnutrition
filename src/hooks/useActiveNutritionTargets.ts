/**
 * Shared hook that resolves the user's active nutrition targets.
 *
 * Priority:
 *  1. Active & valid Competition Prep → override baseline
 *  2. Standard baseline plan → default
 *
 * Every UI surface (dashboard, meal logger, coach, planner) should
 * read targets from this hook so the whole app stays aligned.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getActiveCompPrep, StoredCompPrep } from "@/lib/competitionPrep/service";
import { calculateCompetitionPrep } from "@/lib/competitionPrep/engine";
import type { EventType, CompetitionPrepResult } from "@/lib/competitionPrep/types";

export type TargetSource = "standard" | "competition_prep";

export interface ActiveNutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  waterLiters: number;
  waterLitersTraining: number | null;
  priorities: string[];
  source: TargetSource;
  /** Only present when source === "competition_prep" */
  compPrepMeta?: {
    eventType: string;
    eventDate: string;
    phase: string;
    phaseLabel: string;
    mode: string;
    modeLabel: string;
    trainingDayCalories: number;
    restDayCalories: number;
  };
}

export interface UseActiveNutritionTargetsResult {
  targets: ActiveNutritionTargets;
  baseline: UserBaseline | null;
  compPrep: StoredCompPrep | null;
  compResult: CompetitionPrepResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULT_TARGETS: ActiveNutritionTargets = {
  calories: 2000,
  protein: 120,
  carbs: 200,
  fats: 65,
  sugar: 25,
  waterLiters: 2.5,
  waterLitersTraining: null,
  priorities: [],
  source: "standard",
};

export function useActiveNutritionTargets(): UseActiveNutritionTargetsResult {
  const [targets, setTargets] = useState<ActiveNutritionTargets>(DEFAULT_TARGETS);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [compPrep, setCompPrep] = useState<StoredCompPrep | null>(null);
  const [compResult, setCompResult] = useState<CompetitionPrepResult | null>(null);
  const [loading, setLoading] = useState(true);

  const resolve = useCallback(async () => {
    try {
      const [userBaseline, activePrep] = await Promise.all([
        getUserBaseline(),
        getActiveCompPrep(),
      ]);

      setBaseline(userBaseline);
      setCompPrep(activePrep);

      // Build standard targets from baseline
      const standard: ActiveNutritionTargets = {
        calories: userBaseline?.target_calories || 2000,
        protein: userBaseline?.protein_grams || 120,
        carbs: userBaseline?.carbs_grams || 200,
        fats: userBaseline?.fats_grams || 65,
        sugar: userBaseline?.sugar_grams || 25,
        waterLiters: userBaseline?.water_liters || 2.5,
        waterLitersTraining: userBaseline?.water_liters_training || null,
        priorities: userBaseline?.focus_points || [],
        source: "standard",
      };

      // Check if comp prep should override
      if (activePrep) {
        const eventDate = new Date(activePrep.event_date);
        const now = new Date();
        const isExpired = eventDate < now;

        if (!isExpired) {
          // Calculate live result
          const weightKg = userBaseline?.weight
            ? userBaseline.unit_system === "imperial"
              ? Number(userBaseline.weight) / 2.205
              : Number(userBaseline.weight)
            : 75;
          const tdee = userBaseline?.tdee || 2200;

          try {
            const result = calculateCompetitionPrep({
              eventType: activePrep.event_type as EventType,
              eventDate: activePrep.event_date,
              primaryGoal: activePrep.primary_goal as any,
              goalWeight: activePrep.goal_weight ?? undefined,
              weightKg,
              tdee,
            });

            setCompResult(result);

            const prepTargets: ActiveNutritionTargets = {
              calories: result.calories,
              protein: result.protein,
              carbs: result.carbs,
              fats: result.fats,
              sugar: standard.sugar, // comp prep doesn't override sugar
              waterLiters: standard.waterLiters, // use baseline hydration
              waterLitersTraining: standard.waterLitersTraining,
              priorities: result.priorities,
              source: "competition_prep",
              compPrepMeta: {
                eventType: activePrep.event_type,
                eventDate: activePrep.event_date,
                phase: result.phase,
                phaseLabel: result.phaseLabel,
                mode: result.mode,
                modeLabel: result.modeLabel,
                trainingDayCalories: result.trainingDayCalories,
                restDayCalories: result.restDayCalories,
              },
            };

            setTargets(prepTargets);
            return;
          } catch (e) {
            // Engine threw (e.g. bad data) — fall back to standard
            console.warn("[useActiveNutritionTargets] comp prep calculation failed, using standard:", e);
            setCompResult(null);
          }
        } else {
          // Expired prep — don't override
          setCompResult(null);
        }
      } else {
        setCompResult(null);
      }

      setTargets(standard);
    } catch (error) {
      console.error("[useActiveNutritionTargets] error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return { targets, baseline, compPrep, compResult, loading, refresh: resolve };
}
