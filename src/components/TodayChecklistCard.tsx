import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Droplet, Leaf, ListChecks, Moon, RotateCcw, Sparkles, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useTrackingMode } from "@/hooks/useTrackingMode";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";
import { mentionsNutritionNumbers } from "@/lib/habitCoachCopy";
import {
  computeProgress,
  isItemDone,
  itemCategory,
  type ChecklistCategory,
  localDateString,
  mergeCheckinFocusPoints,
  sortByWhen,
  type ChecklistDayMeal,
  type ChecklistDayState,
  type ChecklistItem,
  type DailyChecklistRow,
} from "@/lib/dailyChecklist";
import {
  getOrGenerateDailyChecklist,
  saveChecklistCompleted,
  saveChecklistItems,
} from "@/lib/dailyChecklistService";
import {
  getOrGenerateWeeklyHabit,
  notifyWeeklyHabitChanged,
  toggleHabitDay,
  WEEKLY_HABIT_CHANGED_EVENT,
  type WeeklyHabit,
} from "@/lib/weeklyHabitService";

const CATEGORY_ICONS: Record<ChecklistCategory, { icon: LucideIcon; className: string }> = {
  nutrition: { icon: UtensilsCrossed, className: "text-primary" },
  sleep: { icon: Moon, className: "text-indigo-500" },
  stress: { icon: Leaf, className: "text-teal-600" },
  hydration: { icon: Droplet, className: "text-sky-500" },
};

interface TodayChecklistCardProps {
  /** True once Today has loaded its own data (meals, water, baseline). */
  ready: boolean;
  meals: ChecklistDayMeal[];
  waterMl: number;
  waterGoalMl: number;
  hasCheckedInToday: boolean;
  dailyFocusPoints: { text: string; tip?: string }[] | null;
  habitUserContext: Record<string, unknown> | null;
}

const ProgressRing = ({ done, total }: { done: number; total: number }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
      <circle
        cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
        className="stroke-primary transition-[stroke-dashoffset] duration-300"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="fill-foreground text-[13px] font-bold">
        {done}/{total}
      </text>
    </svg>
  );
};

export const TodayChecklistCard = ({
  ready,
  meals,
  waterMl,
  waterGoalMl,
  hasCheckedInToday,
  dailyFocusPoints,
  habitUserContext,
}: TodayChecklistCardProps) => {
  const { t, language } = useLanguage();
  const { mode, loading: modeLoading } = useTrackingMode();
  const { targets, loading: targetsLoading } = useActiveNutritionTargets();
  const isHabit = mode === "habits";

  const [row, setRow] = useState<DailyChecklistRow | null>(null);
  const [habit, setHabit] = useState<WeeklyHabit | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);
  const today = localDateString();

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // Make sure this week's habit exists first, so the server can put it on the list.
      if (habitUserContext) {
        try {
          setHabit(await getOrGenerateWeeklyHabit(habitUserContext));
        } catch (e) {
          console.error("Weekly habit for checklist failed:", e);
        }
      }
      const result = await getOrGenerateDailyChecklist({
        date: localDateString(),
        language,
        ...(mode === "calories" && targets.protein ? { proteinTarget: targets.protein } : {}),
      });
      setRow(result);
    } catch (e) {
      console.error("Daily checklist failed:", e);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [habitUserContext, language, mode, targets.protein]);

  // Wait for Today's data, the targets and the food approach before generating.
  useEffect(() => {
    if (!ready || targetsLoading || modeLoading || requested.current) return;
    requested.current = true;
    load();
  }, [ready, targetsLoading, modeLoading, load]);

  // Stay in sync with the Weekly Habit card.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const next = (e as CustomEvent<{ habit?: WeeklyHabit }>).detail?.habit;
      if (next) setHabit(next);
      else if (habitUserContext) getOrGenerateWeeklyHabit(habitUserContext).then(setHabit).catch(() => {});
    };
    window.addEventListener(WEEKLY_HABIT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(WEEKLY_HABIT_CHANGED_EVENT, onChanged);
  }, [habitUserContext]);

  // A check-in done after the list exists adds its focus points (saved back to the row).
  useEffect(() => {
    if (!row || !dailyFocusPoints?.length) return;
    const usable = isHabit ? dailyFocusPoints.filter((p) => !mentionsNutritionNumbers(`${p.text} ${p.tip ?? ""}`)) : dailyFocusPoints;
    const merged = mergeCheckinFocusPoints(row.items, usable);
    if (merged === row.items) return;
    setRow({ ...row, items: merged });
    saveChecklistItems(row.id, merged).catch((e) => console.error("Saving check-in items failed:", e));
  }, [row, dailyFocusPoints, isHabit]);

  const day: ChecklistDayState = useMemo(
    () => ({
      waterMl,
      waterGoalMl,
      meals,
      checkedInToday: hasCheckedInToday,
      habitDoneToday: !!habit?.completed_dates?.includes(today),
    }),
    [waterMl, waterGoalMl, meals, hasCheckedInToday, habit, today],
  );

  const items = useMemo(() => (row ? sortByWhen(row.items) : []), [row]);
  const { done, total } = row ? computeProgress(row.items, row.completed, day) : { done: 0, total: 0 };
  const allDone = total > 0 && done === total;

  const toggleManual = async (item: ChecklistItem) => {
    if (!row) return;
    const previous = row.completed;
    const next = { ...previous };
    if (next[item.id]) delete next[item.id];
    else next[item.id] = new Date().toISOString();
    setRow({ ...row, completed: next });
    try {
      await saveChecklistCompleted(row.id, next);
    } catch (e) {
      console.error("Saving checklist tick failed:", e);
      setRow((r) => (r ? { ...r, completed: previous } : r));
      toast.error(t("checklist_save_error"));
    }
  };

  const toggleHabit = async () => {
    if (!habit) return;
    const previous = habit;
    const dates = habit.completed_dates ?? [];
    const optimistic = dates.includes(today) ? dates.filter((d) => d !== today) : [...dates, today].sort();
    setHabit({ ...habit, completed_dates: optimistic });
    try {
      const updated = await toggleHabitDay(habit.id, today, dates);
      setHabit(updated);
      notifyWeeklyHabitChanged(updated);
    } catch (e) {
      console.error("Weekly habit tick failed:", e);
      setHabit(previous);
      toast.error(t("checklist_save_error"));
    }
  };

  const autoHint = (item: ChecklistItem): string => {
    const rule = item.rule;
    if (!rule) return "";
    switch (rule.type) {
      case "water_goal": return t("checklist_hint_water");
      case "checkin_done": return t("checklist_hint_checkin");
      case "meal_logged": return t(`checklist_hint_${rule.meal}`);
      case "protein_by_hour":
        return t("checklist_hint_protein").replace("{grams}", String(rule.grams)).replace("{hour}", String(rule.hour));
    }
  };

  if (loading) {
    return (
      <section className="bg-card rounded-3xl shadow-medium p-5 space-y-3" aria-busy="true">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full bg-muted rounded-xl animate-pulse" />
        ))}
      </section>
    );
  }

  if (failed || !row) {
    return (
      <section className="bg-card rounded-3xl shadow-medium p-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("checklist_load_error")}</p>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t("checklist_retry")}
        </button>
      </section>
    );
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressLabel = t("checklist_progress").replace("{done}", String(done)).replace("{total}", String(total));

  return (
    <section className={`bg-card rounded-3xl shadow-medium ${isHabit ? "p-6 space-y-5" : "p-5 space-y-3"}`}>
      <div className="flex items-center gap-4">
        {isHabit ? (
          <ProgressRing done={done} total={total} />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={`font-bold text-foreground ${isHabit ? "text-xl" : "text-base"}`}>{t("checklist_title")}</h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">{progressLabel}</p>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={progressLabel}>
        <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      {allDone && (
        <div className="flex items-center gap-2 rounded-2xl bg-primary/10 text-primary px-4 py-3 text-sm font-semibold">
          <Sparkles className="w-4 h-4 shrink-0" />
          {t("checklist_all_done")}
        </div>
      )}

      <ul className={isHabit ? "space-y-3" : "space-y-2"}>
        {items.map((item) => {
          const isDone = isItemDone(item, row.completed, day);
          const isAuto = item.kind === "auto";
          const tappable = !isAuto && (item.kind !== "habit" || !!habit);
          const onTap = () => (item.kind === "habit" ? toggleHabit() : toggleManual(item));
          const category = itemCategory(item);
          const { icon: CategoryIcon, className: categoryClass } = CATEGORY_ICONS[category];
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={!tappable}
                onClick={onTap}
                aria-pressed={tappable ? isDone : undefined}
                data-done={isDone}
                className={`w-full text-left flex items-start gap-3 rounded-2xl border transition-colors ${
                  isHabit ? "p-4" : "p-3"
                } ${isDone ? "border-primary/30 bg-primary/5" : "border-border/60"} ${
                  tappable ? "cursor-pointer hover:border-primary/50" : "cursor-default"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    isHabit ? "w-8 h-8" : "w-7 h-7"
                  } ${isDone ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"}`}
                >
                  {isDone && <Check className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0 block">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-medium">
                      {t(`checklist_when_${item.when}`)}
                    </span>
                    {isAuto && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-semibold">
                        {t("checklist_auto")}
                      </span>
                    )}
                    {item.kind === "habit" && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                        {t("checklist_weekly_habit")}
                      </span>
                    )}
                    {item.source === "checkin" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[11px] font-semibold">
                        {t("checklist_from_checkin")}
                      </span>
                    )}
                  </span>
                  <span className="flex items-start gap-1.5 mt-1">
                    <CategoryIcon
                      className={`shrink-0 ${isHabit ? "w-4 h-4 mt-1" : "w-3.5 h-3.5 mt-[3px]"} ${categoryClass}`}
                      aria-label={t(`checklist_category_${category}`)}
                      role="img"
                    />
                    <span
                      className={`font-medium ${isHabit ? "text-base" : "text-sm"} ${
                        isDone ? "text-muted-foreground line-through decoration-1" : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </span>
                  </span>
                  {item.why && <span className="block text-xs text-muted-foreground mt-0.5">{item.why}</span>}
                  {isAuto && !isDone && <span className="block text-xs text-blue-600/80 mt-0.5">{autoHint(item)}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
