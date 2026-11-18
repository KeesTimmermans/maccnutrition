/**
 * Coach card copy for users on the "simple habits" food approach.
 * Pure functions that never mention calories, macros, targets or percentages —
 * they only use time of day, first name, how many meals were logged, water and check-in.
 */

export interface HabitCoachInput {
  /** 0–23, local time */
  hour: number;
  firstName?: string;
  /** Number of meals logged today (a count, not nutrition). */
  mealsLogged: number;
  waterMl: number;
  waterGoalMl: number;
  checkedInToday: boolean;
}

const timeGreeting = (hour: number) =>
  hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

const withName = (firstName?: string) => (firstName ? `, ${firstName}` : "");

const mealCount = (n: number) => `${n} meal${n === 1 ? "" : "s"}`;

const waterState = (input: HabitCoachInput): "great" | "low" | "ok" => {
  if (input.waterGoalMl <= 0) return "ok";
  if (input.waterMl >= input.waterGoalMl * 0.9) return "great";
  if (input.hour >= 12 && input.waterMl < input.waterGoalMl * 0.5) return "low";
  return "ok";
};

export const generateHabitCoachGreeting = (input: HabitCoachInput): string => {
  const { hour, firstName, mealsLogged, checkedInToday } = input;
  const name = withName(firstName);

  if (mealsLogged === 0) {
    if (hour < 12 && !checkedInToday) {
      return `${timeGreeting(hour)}${name}! A quick check-in and a breakfast log is a lovely way to start.`;
    }
    if (checkedInToday) {
      return `Thanks for checking in${name}! Log your first meal whenever you're ready.`;
    }
    return `${timeGreeting(hour)}${name}! No meals logged yet — a quick log keeps your diary honest.`;
  }

  if (hour >= 18) {
    return `Nice work today${name} — ${mealCount(mealsLogged)} logged.`;
  }
  return `${timeGreeting(hour)}${name}! ${mealCount(mealsLogged)} logged so far — keep it going.`;
};

export const generateHabitCoachInsights = (input: HabitCoachInput): string[] => {
  const insights: string[] = [];
  const name = withName(input.firstName);

  if (input.mealsLogged === 0) {
    insights.push("No meals logged yet — a quick log keeps your diary honest.");
  } else {
    insights.push(`${mealCount(input.mealsLogged)} logged today${name}. Logging as you go keeps it easy.`);
  }

  const water = waterState(input);
  if (water === "great") {
    insights.push("💧 Your water is looking great today.");
  } else if (water === "low") {
    insights.push("💧 Keep a glass of water nearby — little sips add up.");
  }

  if (!input.checkedInToday) {
    insights.push("A quick check-in helps me understand how you're feeling today.");
  } else if (insights.length < 3) {
    insights.push("Thanks for checking in today — it really helps.");
  }

  return insights.slice(0, 3);
};

export const generateHabitCoachTip = (input: HabitCoachInput): string => {
  const { hour, mealsLogged } = input;

  if (hour < 10 && mealsLogged === 0) {
    return "💡 A calm breakfast, eaten slowly, sets a gentle tone for the day.";
  }
  if (waterState(input) === "low") {
    return "💡 Thirst can feel like hunger — try a glass of water first.";
  }
  if (hour >= 18) {
    return "💡 Winding down? A relaxed evening routine helps sleep and tomorrow's choices.";
  }
  if (mealsLogged >= 3) {
    return "💡 Lovely consistency today. Small habits like this add up.";
  }
  return "💡 Try adding some veg or fruit to your next meal — small habits add up.";
};

/**
 * True when text mentions calories, macros, grams, targets or percentages.
 * Used to keep such copy away from habits-mode users.
 */
export const mentionsNutritionNumbers = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return /kcal|\bcals?\b|calor|macro|\d+(?:\.\d+)?\s?g\b|\btargets?\b|%|\b(?:protein|carbs?|fats?|sugars?)\b[^.]*\d|\d[^.]*\b(?:protein|carbs?|fats?|sugars?)\b/i.test(
    text,
  );
};
