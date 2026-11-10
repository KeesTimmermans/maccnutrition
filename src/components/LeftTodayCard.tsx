import { useEffect, useMemo, useState } from "react";
import { Check, Plus, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getFrequentMeals, saveMeal, Meal } from "@/lib/mealService";

interface LeftTodayCardProps {
  remaining: { calories: number; protein: number; carbs: number; fats: number };
  todaysMealNames: string[];
  onLogged: () => void;
  onAskCoach: (prefill: string) => void;
}

type FrequentMeal = Meal & { count: number };

export interface Budget {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface ScaledMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
}

export interface ScaledSuggestion {
  meal: FrequentMeal;
  k: number;
  scaled: ScaledMacros;
  score: number;
}

const clamp0 = (n: number) => Math.max(0, Math.round(n));

/** Default meals left from local hour: before 11 → 3, before 16 → 2, otherwise 1. */
export const defaultMealsLeft = (hour: number): 1 | 2 | 3 => (hour < 11 ? 3 : hour < 16 ? 2 : 1);

/** Per-meal budget = remaining (clamped at 0) split across meals left. */
export const computeBudget = (
  remaining: { calories: number; protein: number; carbs: number; fats: number },
  mealsLeft: number,
): Budget => ({
  calories: Math.max(0, remaining.calories) / mealsLeft,
  protein: Math.max(0, remaining.protein) / mealsLeft,
  carbs: Math.max(0, remaining.carbs) / mealsLeft,
  fats: Math.max(0, remaining.fats) / mealsLeft,
});

/** Portion multiplier: fit calories (+5%) and protein, clamp [0.5, 2], round to nearest 0.25. */
export const computeScaleFactor = (meal: { calories: number; protein: number }, budget: Budget): number => {
  const kCal = (budget.calories * 1.05) / Math.max(meal.calories, 1);
  const kProtein = budget.protein > 5 ? budget.protein / Math.max(meal.protein, 1) : Infinity;
  const k = Math.min(Math.max(Math.min(kCal, kProtein), 0.5), 2);
  return Math.max(0.5, Math.round(k * 4) / 4);
};

export const rankScaledSuggestions = (
  history: FrequentMeal[],
  todaysMealNames: string[],
  budget: Budget,
  limit = 3,
): ScaledSuggestion[] => {
  const todayNames = new Set(todaysMealNames.map((n) => n.toLowerCase().trim()));

  return history
    .filter((m) => !todayNames.has(m.name.toLowerCase().trim()))
    .map((meal) => {
      const k = computeScaleFactor(meal, budget);
      const scaled: ScaledMacros = {
        calories: Math.round(meal.calories * k),
        protein: Math.round(meal.protein * k),
        carbs: Math.round(meal.carbs * k),
        fats: Math.round(meal.fats * k),
        sugar: Math.round((meal.sugar || 0) * k),
      };
      const score =
        1 -
        (0.6 * Math.abs(scaled.protein - budget.protein)) / Math.max(budget.protein, 1) -
        (0.4 * Math.abs(scaled.calories - budget.calories)) / Math.max(budget.calories, 1) +
        0.02 * Math.min(meal.count, 5);
      return { meal, k, scaled, score };
    })
    .filter((s) => s.scaled.calories <= budget.calories * 1.15 && s.scaled.calories >= 80)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const portionTag = (k: number) => (k === 1 ? "usual portion" : `${k}× your last portion`);

export const LeftTodayCard = ({ remaining, todaysMealNames, onLogged, onAskCoach }: LeftTodayCardProps) => {
  const [history, setHistory] = useState<FrequentMeal[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastLoggedName, setLastLoggedName] = useState<string | null>(null);
  const [mealsLeft, setMealsLeft] = useState<number>(() => defaultMealsLeft(new Date().getHours()));

  useEffect(() => {
    let cancelled = false;
    getFrequentMeals().then((meals) => {
      if (!cancelled) setHistory(meals);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const display = {
    calories: clamp0(remaining.calories),
    protein: clamp0(remaining.protein),
    carbs: clamp0(remaining.carbs),
    fats: clamp0(remaining.fats),
  };

  const suggestions = useMemo(
    () => rankScaledSuggestions(history, todaysMealNames, computeBudget(remaining, mealsLeft)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, todaysMealNames, remaining.calories, remaining.protein, remaining.carbs, remaining.fats, mealsLeft],
  );

  const handleLog = async (s: ScaledSuggestion) => {
    if (savingId) return;
    setSavingId(s.meal.id);
    try {
      await saveMeal({
        name: s.meal.name,
        calories: s.scaled.calories,
        protein: s.scaled.protein,
        carbs: s.scaled.carbs,
        fats: s.scaled.fats,
        sugar: s.scaled.sugar,
        ...(s.k !== 1 ? { notes: `Portion adjusted to ${s.k}× from your last logged portion` } : {}),
      });
      setLastLoggedName(s.meal.name);
      setMealsLeft((prev) => Math.max(1, prev - 1));
      toast.success(`${s.meal.name} logged!`);
      onLogged();
    } catch {
      toast.error("Failed to log meal");
    } finally {
      setSavingId(null);
    }
  };

  const askPrefill = `I have ${display.calories} kcal and ${display.protein}g protein left today. What should I eat?`;
  const askButton = (
    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onAskCoach(askPrefill)}>
      <MessageCircle className="w-4 h-4 mr-1.5" />
      Ask Coach Mac
    </Button>
  );

  const targetsHit = remaining.calories <= 0 && remaining.protein <= 0;
  const overCaloriesProteinShort = remaining.calories <= 0 && remaining.protein > 0;
  const smallGapProteinShort = remaining.calories < 100 && remaining.protein > 10;
  const nearTarget = remaining.calories > 0 && remaining.calories < 100 && remaining.protein <= 10;

  const header = (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Left today</p>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="text-2xl font-bold text-foreground">
            {display.calories}
            <span className="text-sm font-medium text-muted-foreground ml-1">kcal</span>
          </span>
          <span className="text-2xl font-bold text-foreground">
            {display.protein}g
            <span className="text-sm font-medium text-muted-foreground ml-1">protein</span>
          </span>
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground leading-relaxed">
        <div>{display.carbs}g carbs</div>
        <div>{display.fats}g fat</div>
      </div>
    </div>
  );

  const loggedLine = lastLoggedName ? (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="w-3.5 h-3.5 text-primary" />
      <span className="truncate">{lastLoggedName} logged</span>
    </p>
  ) : null;

  const mealsLeftSelector = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">Meals left</span>
      <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Meals left">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={mealsLeft === n}
            onClick={() => setMealsLeft(n)}
            className={`min-w-8 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              mealsLeft === n ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  let body: JSX.Element | null = null;

  if (targetsHit) {
    body = <p className="text-sm text-muted-foreground">Targets hit for today</p>;
  } else if (overCaloriesProteinShort) {
    body = <div>{askButton}</div>;
  } else if (remaining.calories >= 100) {
    if (suggestions.length > 0) {
      body = (
        <div className="space-y-2">
          {mealsLeftSelector}
          {suggestions.map((s) => {
            const isSaving = savingId === s.meal.id;
            return (
              <div
                key={s.meal.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.meal.name}</p>
                  <p className="text-[11px] text-muted-foreground">{portionTag(s.k)}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.scaled.calories} kcal · {s.scaled.protein}g protein
                  </p>
                </div>
                <button
                  onClick={() => handleLog(s)}
                  disabled={isSaving || !!savingId}
                  aria-label={`Log ${s.meal.name}`}
                  className="shrink-0 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      );
    } else {
      body = (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Not sure what to eat?</p>
          {askButton}
        </div>
      );
    }
  } else if (smallGapProteinShort) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Almost there. A small protein snack would close the gap.</p>
        {askButton}
      </div>
    );
  } else if (nearTarget) {
    body = <p className="text-sm text-muted-foreground">You're right on target for today</p>;
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      {header}
      {loggedLine}
      {body}
    </div>
  );
};
