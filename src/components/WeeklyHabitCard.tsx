import { useEffect, useRef, useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { Check } from "lucide-react";
import { toast } from "sonner";
import {
  getOrGenerateWeeklyHabit,
  toggleHabitDay,
  type WeeklyHabit,
} from "@/lib/weeklyHabitService";

interface WeeklyHabitCardProps {
  userContext: Record<string, unknown> | null;
}

export const WeeklyHabitCard = ({ userContext }: WeeklyHabitCardProps) => {
  const [habit, setHabit] = useState<WeeklyHabit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requested = useRef(false);

  const today = new Date();
  const weekDays = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  });

  const load = async (ctx: Record<string, unknown>) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getOrGenerateWeeklyHabit(ctx);
      setHabit(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your weekly habit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userContext || Object.keys(userContext).length === 0) return;
    if (requested.current) return;
    requested.current = true;
    load(userContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userContext]);

  const completed = habit?.completed_dates ?? [];

  const handleToggle = async (dateStr: string) => {
    if (!habit || saving) return;
    const previous = completed;
    const optimistic = previous.includes(dateStr)
      ? previous.filter((d) => d !== dateStr)
      : [...previous, dateStr].sort();

    setHabit({ ...habit, completed_dates: optimistic });
    setSaving(true);
    try {
      const updated = await toggleHabitDay(habit.id, dateStr, previous);
      setHabit(updated);
    } catch (e) {
      setHabit({ ...habit, completed_dates: previous });
      toast.error(e instanceof Error ? e.message : "Couldn't update your habit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!userContext || isLoading) {
    return (
      <section className="bg-card rounded-3xl shadow-medium p-5 space-y-4">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
        <div className="flex gap-2">
          {weekDays.map((d) => (
            <div key={d.toISOString()} className="flex-1 h-14 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error || !habit) {
    return (
      <section className="bg-card rounded-3xl shadow-medium p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Weekly Habit</h2>
        <p className="text-sm text-foreground">{error ?? "Couldn't load your weekly habit."}</p>
        <button
          onClick={() => userContext && load(userContext)}
          className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-3xl shadow-medium p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Weekly Habit
          </p>
          <h2 className="text-lg font-bold text-foreground mt-1">{habit.habit_title}</h2>
        </div>
        {habit.difficulty_label && (
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {habit.difficulty_label}
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{habit.habit_description}</p>

      <div className="flex gap-2">
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, today);
          const isDone = completed.includes(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isToday || saving}
              onClick={() => handleToggle(dateStr)}
              aria-label={`${format(day, "EEEE")}${isDone ? " completed" : ""}`}
              aria-pressed={isDone}
              className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-colors ${
                isToday
                  ? "border-primary/40 hover:bg-primary/5 cursor-pointer"
                  : "border-border/60 opacity-60 cursor-not-allowed"
              }`}
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                {format(day, "EEE")}
              </span>
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center border ${
                  isDone
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-transparent border-border"
                }`}
              >
                {isDone && <Check className="w-4 h-4" />}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm font-semibold text-foreground">{completed.length}/7 this week</p>
    </section>
  );
};
