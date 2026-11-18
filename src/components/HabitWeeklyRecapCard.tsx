import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getMealsByDateRange } from "@/lib/mealService";
import { getWaterIntakeByDateRange } from "@/lib/waterService";
import { getRecentCheckIns } from "@/lib/checkinService";
import { getRecapWeek, type Direction } from "@/lib/weeklyRecap";
import { buildHabitRecap, groupHabitRecapDays, type HabitRecapInput, type HabitRecapRawData } from "@/lib/habitRecap";
import { useLanguage } from "@/lib/i18n";

interface HabitWeeklyRecapCardProps {
  waterGoalMl: number;
  onAskCoach: (prefill: string) => void;
}

const DISMISS_KEY = "habit-weekly-recap-dismissed";
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const readDismissed = (): string | null => {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

const arrow = (d: Direction) => (d === "up" ? " ↑" : d === "down" ? " ↓" : d === "same" ? " →" : "");

type FetchedData = HabitRecapRawData & Pick<HabitRecapInput, "habit" | "checkIns">;

/** Habits-mode weekly recap (Sundays and Mondays). Counts only — no calories, macros or targets. */
export const HabitWeeklyRecapCard = ({ waterGoalMl, onAskCoach }: HabitWeeklyRecapCardProps) => {
  const { t } = useLanguage();
  const [week] = useState(() => getRecapWeek(new Date()));
  const weekKey = week ? format(week.start, "yyyy-MM-dd") : null;
  const [dismissed, setDismissed] = useState(() => weekKey !== null && readDismissed() === weekKey);
  const [data, setData] = useState<FetchedData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!week || dismissed) return;
    let cancelled = false;
    const startStr = format(week.start, "yyyy-MM-dd");
    const endStr = format(week.end, "yyyy-MM-dd");
    const prevStartStr = format(subDays(week.start, 7), "yyyy-MM-dd");

    const load = async (): Promise<FetchedData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const [meals, water, checklistRes, habitRes, checkIns] = await Promise.all([
        getMealsByDateRange(week.start, week.end),
        getWaterIntakeByDateRange(week.start, week.end),
        supabase
          .from("daily_checklists")
          .select("checklist_date, items, completed")
          .eq("user_id", user.id)
          .gte("checklist_date", startStr)
          .lte("checklist_date", endStr),
        supabase
          .from("weekly_habits")
          .select("habit_title, completed_dates")
          .eq("user_id", user.id)
          .gte("week_start_date", startStr)
          .lte("week_start_date", endStr)
          .limit(1),
        getRecentCheckIns(21),
      ]);
      if (checklistRes.error) throw checklistRes.error;
      if (habitRes.error) throw habitRes.error;
      const habitRow = habitRes.data?.[0];
      const weekCheckIns = (checkIns || []).filter((c) => c.check_in_date >= prevStartStr && c.check_in_date <= endStr);
      return {
        meals: (meals || []).map((m) => ({ logged_at: m.logged_at })),
        water: (water || []).map((w) => ({ logged_at: w.logged_at, amount_ml: w.amount_ml })),
        checklists: checklistRes.data || [],
        checkInDates: weekCheckIns.map((c) => c.check_in_date),
        habit: habitRow ? { habit_title: habitRow.habit_title, completed_dates: habitRow.completed_dates || [] } : null,
        checkIns: weekCheckIns.map((c) => ({
          check_in_date: c.check_in_date,
          energy_level: c.energy_level,
          sleep_quality: c.sleep_quality,
        })),
      };
    };

    load()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Fetch once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recap = useMemo(() => {
    if (!week || !data) return null;
    return buildHabitRecap({
      days: groupHabitRecapDays(week.start, data),
      waterGoalMl,
      habit: data.habit,
      checkIns: data.checkIns,
    });
  }, [week, data, waterGoalMl]);

  if (!week || dismissed || failed) return null;

  if (!recap) {
    return (
      <div className="rounded-2xl bg-card border border-border p-4 space-y-4" aria-busy="true">
        <Skeleton className="h-5 w-40" />
        <div className="flex justify-between">
          {DAY_LABELS.map((_, i) => (
            <Skeleton key={i} className="w-7 h-7 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const { totals } = recap;
  if (totals.daysLogged === 0 && totals.itemsDone === 0 && totals.habitDays === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (weekKey) localStorage.setItem(DISMISS_KEY, weekKey);
    } catch {
      // Storage unavailable: the card hides for now and may come back after a reload.
    }
  };

  const moodParts: string[] = [];
  if (recap.energy) moodParts.push(`${t("habit_recap_energy")} ${recap.energy.avg.toFixed(1)}/5${arrow(recap.energy.direction)}`);
  if (recap.sleep) moodParts.push(`${t("habit_recap_sleep")} ${recap.sleep.avg.toFixed(1)}/5${arrow(recap.sleep.direction)}`);

  const stats = [
    { label: t("habit_recap_days_logged"), value: `${totals.daysLogged}/7` },
    { label: t("habit_recap_water_days"), value: `${totals.waterDays}/7` },
    ...(recap.habit ? [{ label: t("habit_recap_habit_days"), value: `${totals.habitDays}/7` }] : []),
  ];

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t("habit_recap_title")}</h3>
        <span className="text-xs text-muted-foreground">
          {week.isFinal ? t("habit_recap_last_week") : t("habit_recap_so_far")}
        </span>
      </div>

      <div className="flex justify-between">
        {recap.days.map((d, i) => (
          <div key={d.dateStr} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-muted-foreground">{DAY_LABELS[i]}</span>
            <span
              aria-label={`${d.dateStr}: ${d.state}`}
              className={`w-7 h-7 rounded-full border-2 ${
                d.state === "full"
                  ? "bg-primary border-primary"
                  : d.state === "half"
                    ? "border-primary bg-[linear-gradient(to_top,hsl(var(--primary))_50%,transparent_50%)]"
                    : "border-muted bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {recap.hasChecklistData && (
        <p className="text-sm text-center text-foreground">
          {t("habit_recap_items")
            .replace("{done}", String(totals.itemsDone))
            .replace("{total}", String(totals.itemsTotal))}
        </p>
      )}

      <div className={`grid gap-2 text-center ${stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
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
          <span className="font-semibold">{t("habit_recap_win_label")}</span> {t(recap.winKey)}
        </p>
        <p className="text-foreground">
          <span className="font-semibold">{t("habit_recap_focus_label")}</span> {t(recap.focusKey)}
        </p>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" size="sm" onClick={() => onAskCoach(t(recap.prefillKey))}>
          <MessageCircle className="w-4 h-4 mr-1.5" />
          {t("habit_recap_ask_coach")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDismiss}>
          {t("habit_recap_got_it")}
        </Button>
      </div>
    </div>
  );
};
