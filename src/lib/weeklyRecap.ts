import { addDays, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";

/** Pure helpers for the Sunday/Monday weekly recap card. No React, no network. */

export interface RecapWeek {
  start: Date;
  end: Date;
  isFinal: boolean;
}

/** Sunday → this week so far (not final). Monday → last week (final). Any other day → null. */
export function getRecapWeek(now: Date): RecapWeek | null {
  const day = now.getDay(); // 0 = Sunday, 1 = Monday
  if (day !== 0 && day !== 1) return null;
  const ref = day === 1 ? subWeeks(now, 1) : now;
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  start.setHours(0, 0, 0, 0);
  const end = endOfWeek(ref, { weekStartsOn: 1 });
  end.setHours(23, 59, 59, 999);
  return { start, end, isFinal: day === 1 };
}

export interface RecapInput {
  meals: { logged_at: string; calories: number; protein: number }[];
  targets: { calories: number; protein: number };
  weekStart: Date;
  habit: { habit_title: string; completed_dates: string[] } | null;
  /** Check-ins covering the recap week and the week before. */
  checkIns: { check_in_date: string; energy_level: number; sleep_quality: number }[];
  isFinal: boolean;
}

export interface RecapDay {
  dateStr: string;
  logged: boolean;
  proteinMet: boolean;
  caloriesMet: boolean;
}

export type Direction = "up" | "down" | "same" | null;

export interface RecapMetric {
  avg: number;
  direction: Direction;
}

export interface Recap {
  days: RecapDay[];
  daysLogged: number;
  proteinDays: number;
  caloriesDays: number;
  avgProtein: number;
  avgCalories: number;
  habit: { title: string; doneCount: number } | null;
  energy: RecapMetric | null;
  sleep: RecapMetric | null;
  win: string;
  focus: string;
  coachPrefill: string;
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

export function metricFor(
  current: number[],
  previous: number[]
): RecapMetric | null {
  if (current.length < 3) return null;
  const avg = mean(current);
  let direction: Direction = null;
  if (previous.length >= 3) {
    const diff = avg - mean(previous);
    direction = diff >= 0.3 ? "up" : diff <= -0.3 ? "down" : "same";
  }
  return { avg: Math.round(avg * 10) / 10, direction };
}

export function buildRecap(input: RecapInput): Recap {
  const { meals, targets, weekStart, habit, checkIns } = input;

  const dateStrs = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));

  // Bucket by day exactly like WeeklyAchievements (logged_at.startsWith(dateStr)) so numbers match Progress.
  const dayTotals = dateStrs.map((dateStr) => {
    const dayMeals = meals.filter((m) => m.logged_at.startsWith(dateStr));
    return {
      dateStr,
      logged: dayMeals.length > 0,
      calories: dayMeals.reduce((s, m) => s + (m.calories || 0), 0),
      protein: dayMeals.reduce((s, m) => s + (m.protein || 0), 0),
    };
  });

  const days: RecapDay[] = dayTotals.map((d) => ({
    dateStr: d.dateStr,
    logged: d.logged,
    proteinMet: d.logged && d.protein >= targets.protein * 0.9,
    caloriesMet: d.logged && d.calories >= targets.calories * 0.9 && d.calories <= targets.calories * 1.1,
  }));

  const loggedTotals = dayTotals.filter((d) => d.logged);
  const daysLogged = loggedTotals.length;
  const proteinDays = days.filter((d) => d.proteinMet).length;
  const caloriesDays = days.filter((d) => d.caloriesMet).length;
  const avgProtein = daysLogged ? Math.round(mean(loggedTotals.map((d) => d.protein))) : 0;
  const avgCalories = daysLogged ? Math.round(mean(loggedTotals.map((d) => d.calories))) : 0;

  const weekStartStr = dateStrs[0];
  const weekEndStr = dateStrs[6];
  const inWeek = (s: string) => s >= weekStartStr && s <= weekEndStr;

  const recapHabit = habit
    ? { title: habit.habit_title, doneCount: new Set(habit.completed_dates.filter(inWeek)).size }
    : null;

  const prevStartStr = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const prevEndStr = format(addDays(weekStart, -1), "yyyy-MM-dd");
  const current = checkIns.filter((c) => inWeek(c.check_in_date));
  const previous = checkIns.filter((c) => c.check_in_date >= prevStartStr && c.check_in_date <= prevEndStr);

  const energy = metricFor(current.map((c) => c.energy_level), previous.map((c) => c.energy_level));
  const sleep = metricFor(current.map((c) => c.sleep_quality), previous.map((c) => c.sleep_quality));

  let win: string;
  if (recapHabit && recapHabit.doneCount >= 6) win = `You nailed your habit: ${recapHabit.doneCount}/7 days.`;
  else if (proteinDays >= 5) win = `You hit your protein on ${proteinDays} days.`;
  else if (daysLogged >= 5) win = `You logged ${daysLogged} days this week.`;
  else if (daysLogged >= 3) win = `Showing up counts: ${daysLogged} days logged.`;
  else win = "You're tracking, and that's the first step.";

  let focus: string;
  if (daysLogged < 4) focus = "Aim to log at least 5 days next week. Logging is what makes everything else work.";
  else if (daysLogged >= 3 && proteinDays < 4) focus = "Aim to hit your protein on 5 days. Add a protein source to breakfast to get a head start.";
  else if (daysLogged >= 3 && caloriesDays < 3) focus = "Aim to land closer to your calorie target. The Left today card on the Today page shows what fits.";
  else if (sleep && sleep.avg < 3) focus = "Protect your sleep this week. It drives hunger and energy.";
  else focus = "Keep going. Repeat what worked this week.";

  const coachPrefill = `Here's my week: logged ${daysLogged} days, protein target hit on ${proteinDays} days${
    recapHabit ? `, habit ${recapHabit.doneCount}/7` : ""
  }. What's one thing I should focus on next week?`;

  return {
    days,
    daysLogged,
    proteinDays,
    caloriesDays,
    avgProtein,
    avgCalories,
    habit: recapHabit,
    energy,
    sleep,
    win,
    focus,
    coachPrefill,
  };
}
