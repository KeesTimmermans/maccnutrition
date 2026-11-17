import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMealsByDateRange } from "@/lib/mealService";
import { getRecentCheckIns } from "@/lib/checkinService";
import { buildRecap, getRecapWeek, type Direction, type RecapInput } from "@/lib/weeklyRecap";

interface WeeklyRecapCardProps {
  targets: { calories: number; protein: number };
  onAskCoach: (prefill: string) => void;
}

const DISMISS_KEY = "weekly-recap-dismissed";
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

const arrow = (d: Direction) => (d === "up" ? " ↑" : d === "down" ? " ↓" : d === "same" ? " →" : "");

type FetchedData = Pick<RecapInput, "meals" | "habit" | "checkIns">;

export const WeeklyRecapCard = ({ targets, onAskCoach }: WeeklyRecapCardProps) => {
  const [week] = useState(() => getRecapWeek(new Date()));
  const weekKey = week ? format(week.start, "yyyy-MM-dd") : null;
  const [dismissed, setDismissed] = useState(() => weekKey !== null && readDismissed() === weekKey);
  const [data, setData] = useState<FetchedData | null>(null);

  useEffect(() => {
    if (!week || dismissed) return;
    let cancelled = false;

    const fetchHabit = async (): Promise<RecapInput["habit"]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: rows, error } = await supabase
        .from("weekly_habits")
        .select("habit_title, completed_dates")
        .eq("user_id", user.id)
        .gte("week_start_date", format(week.start, "yyyy-MM-dd"))
        .lte("week_start_date", format(week.end, "yyyy-MM-dd"))
        .limit(1);
      if (error || !rows || rows.length === 0) return null;
      return { habit_title: rows[0].habit_title, completed_dates: rows[0].completed_dates || [] };
    };

    const prevStartStr = format(subDays(week.start, 7), "yyyy-MM-dd");
    const endStr = format(week.end, "yyyy-MM-dd");

    Promise.all([
      getMealsByDateRange(week.start, week.end).catch(() => []),
      fetchHabit().catch(() => null),
      getRecentCheckIns(21).catch(() => []),
    ]).then(([meals, habit, checkIns]) => {
      if (cancelled) return;
      setData({
        meals: (meals || []).map((m) => ({ logged_at: m.logged_at, calories: m.calories, protein: m.protein })),
        habit,
        checkIns: (checkIns || [])
          .filter((c) => c.check_in_date >= prevStartStr && c.check_in_date <= endStr)
          .map((c) => ({ check_in_date: c.check_in_date, energy_level: c.energy_level, sleep_quality: c.sleep_quality })),
      });
    });

    return () => {
      cancelled = true;
    };
    // Fetch once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recap = useMemo(() => {
    if (!week || !data) return null;
    return buildRecap({ ...data, targets, weekStart: week.start, isFinal: week.isFinal });
  }, [week, data, targets]);

  if (!week || dismissed || !recap || recap.daysLogged === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (weekKey) localStorage.setItem(DISMISS_KEY, weekKey);
    } catch {
      // Storage unavailable: the card hides for now and may come back after a reload.
    }
  };

  const moodParts: string[] = [];
  if (recap.energy) moodParts.push(`Energy ${recap.energy.avg.toFixed(1)}/5${arrow(recap.energy.direction)}`);
  if (recap.sleep) moodParts.push(`Sleep ${recap.sleep.avg.toFixed(1)}/5${arrow(recap.sleep.direction)}`);

  const stats = [
    { label: "Days logged", value: `${recap.daysLogged}/7` },
    { label: "Protein hit", value: `${recap.proteinDays} days` },
    { label: "Avg protein", value: `${recap.avgProtein}g` },
    ...(recap.habit ? [{ label: "Habit", value: `${recap.habit.doneCount}/7` }] : []),
  ];

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
      <h3 className="font-semibold text-foreground">
        {week.isFinal ? "Your week in review" : "Your week so far"}
      </h3>

      <div className="flex justify-between">
        {recap.days.map((d, i) => (
          <div key={d.dateStr} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{DAY_LABELS[i]}</span>
            <span
              aria-label={`${d.dateStr}: ${d.logged ? "logged" : "not logged"}${d.proteinMet ? ", protein met" : ""}`}
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                d.logged ? "bg-primary text-primary-foreground" : "bg-muted"
              } ${d.proteinMet ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""}`}
            >
              {d.proteinMet && <Check className="w-3.5 h-3.5" />}
            </span>
          </div>
        ))}
      </div>

      <div className={`grid gap-2 text-center ${stats.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/50 px-2 py-2">
            <p className="text-sm font-semibold text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {moodParts.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">{moodParts.join(" · ")}</p>
      )}

      <div className="space-y-1.5 text-sm">
        <p className="text-foreground">
          <span className="font-semibold">Win:</span> {recap.win}
        </p>
        <p className="text-foreground">
          <span className="font-semibold">Focus:</span> {recap.focus}
        </p>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" size="sm" onClick={() => onAskCoach(recap.coachPrefill)}>
          <MessageCircle className="w-4 h-4 mr-1.5" />
          Talk it through with Coach Mac
        </Button>
        <Button variant="outline" size="sm" onClick={handleDismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
};
