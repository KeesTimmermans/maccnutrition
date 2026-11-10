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

const clamp0 = (n: number) => Math.max(0, Math.round(n));

export const LeftTodayCard = ({ remaining, todaysMealNames, onLogged, onAskCoach }: LeftTodayCardProps) => {
  const [history, setHistory] = useState<FrequentMeal[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

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

  const suggestions = useMemo(() => {
    const todayNames = new Set(todaysMealNames.map((n) => n.toLowerCase().trim()));
    const remCal = remaining.calories;
    const remProtein = remaining.protein;

    return history
      .filter((m) => !todayNames.has(m.name.toLowerCase().trim()) || loggedIds.has(m.id))
      .filter((m) => loggedIds.has(m.id) || (m.calories >= 80 && m.calories <= remCal * 1.1))
      .map((m) => {
        const proteinFit = Math.min(m.protein, remProtein) / Math.max(remProtein, 1);
        const overshoot = remCal > 0 ? Math.max(0, m.calories - remCal) / remCal : 0;
        const score = proteinFit - 0.5 * overshoot + 0.02 * Math.min(m.count, 5);
        return { meal: m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.meal);
  }, [history, todaysMealNames, remaining.calories, remaining.protein, loggedIds]);

  const handleLog = async (meal: FrequentMeal) => {
    if (savingId || loggedIds.has(meal.id)) return;
    setSavingId(meal.id);
    try {
      await saveMeal({
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        sugar: meal.sugar,
      });
      setLoggedIds((prev) => new Set(prev).add(meal.id));
      toast.success(`${meal.name} logged!`);
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

  let body: JSX.Element | null = null;

  if (targetsHit) {
    body = <p className="text-sm text-muted-foreground">Targets hit for today</p>;
  } else if (overCaloriesProteinShort) {
    body = <div>{askButton}</div>;
  } else if (remaining.calories >= 100) {
    if (suggestions.length > 0) {
      body = (
        <div className="space-y-2">
          {suggestions.map((meal) => {
            const isSaving = savingId === meal.id;
            const isLogged = loggedIds.has(meal.id);
            return (
              <div
                key={meal.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{meal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(meal.calories)} kcal · {Math.round(meal.protein)}g protein
                  </p>
                </div>
                <button
                  onClick={() => handleLog(meal)}
                  disabled={isSaving || isLogged || !!savingId}
                  aria-label={isLogged ? `${meal.name} logged` : `Log ${meal.name}`}
                  className="shrink-0 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  {isLogged ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
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
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      {header}
      {body}
    </div>
  );
};
