import { Meal, getMealsByDateRange } from "@/lib/mealService";
import { DailyCheckIn, getRecentCheckIns } from "@/lib/checkinService";
import { UserBaseline } from "@/lib/userService";

export interface MealPatternAnalysis {
  averageProteinPerDay: number;
  averageCaloriesPerDay: number;
  averageMealsPerDay: number;
  proteinConsistency: "high" | "medium" | "low";
  calorieConsistency: "high" | "medium" | "low";
  mostCommonMealTime: string;
  daysTracked: number;
  weeklyProteinHitRate: number; // % of days hitting protein goal
  weeklyCalorieHitRate: number; // % of days hitting calorie goal
  peakPerformanceDays: string[]; // Days where goals were met
  challengeDays: string[]; // Days where goals were missed significantly
  proteinTrend: "improving" | "declining" | "stable";
  calorieTrend: "improving" | "declining" | "stable";
  averageProteinByMealNumber: number[];
  weekendVsWeekday: {
    weekdayAvgCalories: number;
    weekendAvgCalories: number;
    weekdayAvgProtein: number;
    weekendAvgProtein: number;
  };
}

export interface CoachingContext {
  mealPatterns: MealPatternAnalysis | null;
  recentCheckIns: DailyCheckIn[];
  baseline: UserBaseline | null;
  todaysMeals: { calories: number; protein: number; carbs: number; fats: number }[];
  waterIntakeMl: number;
  currentHour: number;
  isWeekend: boolean;
  dayOfWeek: string;
  accountAgeDays: number;
}

/**
 * Analyze meal patterns from the past 7 days
 */
export async function analyzeMealPatterns(
  baseline: UserBaseline | null
): Promise<MealPatternAnalysis | null> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const meals = await getMealsByDateRange(startDate, endDate);
    
    if (meals.length === 0) {
      return null;
    }

    const proteinGoal = baseline?.protein_grams || 120;
    const calorieGoal = baseline?.target_calories || 2000;

    // Group meals by day
    const mealsByDay: Record<string, Meal[]> = {};
    meals.forEach(meal => {
      const date = new Date(meal.logged_at).toDateString();
      if (!mealsByDay[date]) mealsByDay[date] = [];
      mealsByDay[date].push(meal);
    });

    const daysWithMeals = Object.keys(mealsByDay);
    const daysTracked = daysWithMeals.length;

    // Calculate daily totals
    const dailyTotals = daysWithMeals.map(date => {
      const dayMeals = mealsByDay[date];
      const isWeekend = [0, 6].includes(new Date(date).getDay());
      return {
        date,
        isWeekend,
        calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
        protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
        mealCount: dayMeals.length,
        meals: dayMeals,
      };
    });

    // Average calculations
    const avgCalories = dailyTotals.reduce((sum, d) => sum + d.calories, 0) / daysTracked;
    const avgProtein = dailyTotals.reduce((sum, d) => sum + d.protein, 0) / daysTracked;
    const avgMeals = dailyTotals.reduce((sum, d) => sum + d.mealCount, 0) / daysTracked;

    // Goal hit rates
    const daysHittingProtein = dailyTotals.filter(d => d.protein >= proteinGoal * 0.9).length;
    const daysHittingCalories = dailyTotals.filter(
      d => d.calories >= calorieGoal * 0.85 && d.calories <= calorieGoal * 1.15
    ).length;

    const proteinHitRate = Math.round((daysHittingProtein / daysTracked) * 100);
    const calorieHitRate = Math.round((daysHittingCalories / daysTracked) * 100);

    // Consistency calculations (standard deviation)
    const proteinStdDev = calculateStdDev(dailyTotals.map(d => d.protein));
    const calorieStdDev = calculateStdDev(dailyTotals.map(d => d.calories));

    const proteinConsistency: "high" | "medium" | "low" = 
      proteinStdDev < 20 ? "high" : proteinStdDev < 40 ? "medium" : "low";
    const calorieConsistency: "high" | "medium" | "low" = 
      calorieStdDev < 200 ? "high" : calorieStdDev < 400 ? "medium" : "low";

    // Peak performance and challenge days
    const peakPerformanceDays = dailyTotals
      .filter(d => d.protein >= proteinGoal * 0.9 && d.calories >= calorieGoal * 0.85)
      .map(d => d.date);

    const challengeDays = dailyTotals
      .filter(d => d.protein < proteinGoal * 0.6 || d.calories < calorieGoal * 0.5)
      .map(d => d.date);

    // Trends (compare first half vs second half of week)
    const midpoint = Math.floor(dailyTotals.length / 2);
    const firstHalf = dailyTotals.slice(midpoint);
    const secondHalf = dailyTotals.slice(0, midpoint);

    const firstHalfProtein = firstHalf.length > 0 
      ? firstHalf.reduce((sum, d) => sum + d.protein, 0) / firstHalf.length 
      : 0;
    const secondHalfProtein = secondHalf.length > 0 
      ? secondHalf.reduce((sum, d) => sum + d.protein, 0) / secondHalf.length 
      : 0;

    const proteinTrend: "improving" | "declining" | "stable" =
      secondHalfProtein - firstHalfProtein > 10 ? "improving" :
      firstHalfProtein - secondHalfProtein > 10 ? "declining" : "stable";

    const firstHalfCalories = firstHalf.length > 0 
      ? firstHalf.reduce((sum, d) => sum + d.calories, 0) / firstHalf.length 
      : 0;
    const secondHalfCalories = secondHalf.length > 0 
      ? secondHalf.reduce((sum, d) => sum + d.calories, 0) / secondHalf.length 
      : 0;

    const calorieTrend: "improving" | "declining" | "stable" =
      Math.abs(secondHalfCalories - firstHalfCalories) < 150 ? "stable" :
      secondHalfCalories > firstHalfCalories ? "improving" : "declining";

    // Weekend vs weekday analysis
    const weekdayTotals = dailyTotals.filter(d => !d.isWeekend);
    const weekendTotals = dailyTotals.filter(d => d.isWeekend);

    const weekendVsWeekday = {
      weekdayAvgCalories: weekdayTotals.length > 0 
        ? Math.round(weekdayTotals.reduce((sum, d) => sum + d.calories, 0) / weekdayTotals.length)
        : 0,
      weekendAvgCalories: weekendTotals.length > 0 
        ? Math.round(weekendTotals.reduce((sum, d) => sum + d.calories, 0) / weekendTotals.length)
        : 0,
      weekdayAvgProtein: weekdayTotals.length > 0 
        ? Math.round(weekdayTotals.reduce((sum, d) => sum + d.protein, 0) / weekdayTotals.length)
        : 0,
      weekendAvgProtein: weekendTotals.length > 0 
        ? Math.round(weekendTotals.reduce((sum, d) => sum + d.protein, 0) / weekendTotals.length)
        : 0,
    };

    // Most common meal time
    const mealHours = meals.map(m => new Date(m.logged_at).getHours());
    const hourCounts: Record<number, number> = {};
    mealHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const peakHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "12";
    const mostCommonMealTime = `${peakHour}:00`;

    // Protein by meal number (1st, 2nd, 3rd meal of day)
    const proteinByMealNumber: number[] = [0, 0, 0];
    const mealNumberCounts = [0, 0, 0];
    Object.values(mealsByDay).forEach(dayMeals => {
      dayMeals.sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
      dayMeals.slice(0, 3).forEach((meal, idx) => {
        proteinByMealNumber[idx] += meal.protein;
        mealNumberCounts[idx]++;
      });
    });
    const averageProteinByMealNumber = proteinByMealNumber.map((total, idx) => 
      mealNumberCounts[idx] > 0 ? Math.round(total / mealNumberCounts[idx]) : 0
    );

    return {
      averageProteinPerDay: Math.round(avgProtein),
      averageCaloriesPerDay: Math.round(avgCalories),
      averageMealsPerDay: Math.round(avgMeals * 10) / 10,
      proteinConsistency,
      calorieConsistency,
      mostCommonMealTime,
      daysTracked,
      weeklyProteinHitRate: proteinHitRate,
      weeklyCalorieHitRate: calorieHitRate,
      peakPerformanceDays,
      challengeDays,
      proteinTrend,
      calorieTrend,
      averageProteinByMealNumber,
      weekendVsWeekday,
    };
  } catch (error) {
    console.error("Error analyzing meal patterns:", error);
    return null;
  }
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length);
}

/**
 * Calculate account age from baseline creation date
 */
export function getAccountAgeDays(baseline: UserBaseline | null): number {
  if (!baseline?.created_at) return 0;
  const createdAt = new Date(baseline.created_at);
  const now = new Date();
  return Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Build comprehensive coaching context for AI recommendations
 */
export async function buildCoachingContext(
  baseline: UserBaseline | null,
  todaysMeals: { calories: number; protein: number; carbs: number; fats: number }[],
  waterIntakeMl: number
): Promise<CoachingContext> {
  const [mealPatterns, recentCheckIns] = await Promise.all([
    analyzeMealPatterns(baseline),
    getRecentCheckIns(7),
  ]);

  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    mealPatterns,
    recentCheckIns,
    baseline,
    todaysMeals,
    waterIntakeMl,
    currentHour: now.getHours(),
    isWeekend: [0, 6].includes(now.getDay()),
    dayOfWeek: days[now.getDay()],
    accountAgeDays: getAccountAgeDays(baseline),
  };
}
