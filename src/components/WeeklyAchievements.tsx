import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, Droplets, Flame, Check, X, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { getMealsByDateRange, Meal } from "@/lib/mealService";
import { getWaterIntakeByDateRange, WaterIntake } from "@/lib/waterService";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";
import { useLanguage } from "@/lib/i18n";

interface DayAchievement {
  date: Date;
  dayName: string;
  calories: { value: number; goal: number; met: boolean };
  protein: { value: number; goal: number; met: boolean };
  carbs: { value: number; goal: number; met: boolean };
  fats: { value: number; goal: number; met: boolean };
  water: { value: number; goal: number; met: boolean };
  allGoalsMet: boolean;
}

interface WeeklyStats {
  perfectDays: number;
  calorieGoalDays: number;
  proteinGoalDays: number;
  carbsGoalDays: number;
  fatsGoalDays: number;
  waterGoalDays: number;
  totalDaysTracked: number;
}

export const WeeklyAchievements = () => {
  const { t } = useLanguage();
  const { targets: activeTargets, loading: targetsLoading } = useActiveNutritionTargets();
  const [achievements, setAchievements] = useState<DayAchievement[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!targetsLoading) {
      loadWeeklyData();
    }
  }, [targetsLoading]);

  const loadWeeklyData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const [meals, waterIntakes] = await Promise.all([
        getMealsByDateRange(weekStart, weekEnd),
        getWaterIntakeByDateRange(weekStart, weekEnd),
      ]);

      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      const calorieGoal = activeTargets.calories;
      const proteinGoal = activeTargets.protein;
      const carbsGoal = activeTargets.carbs;
      const fatsGoal = activeTargets.fats;
      const waterGoalMl = activeTargets.waterLiters * 1000;

      const dayAchievements: DayAchievement[] = days.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayMeals = meals.filter(m => m.logged_at.startsWith(dateStr));
        const dayWater = waterIntakes.filter(w => w.logged_at.startsWith(dateStr));

        const totalCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const totalProtein = dayMeals.reduce((sum, m) => sum + m.protein, 0);
        const totalCarbs = dayMeals.reduce((sum, m) => sum + m.carbs, 0);
        const totalFats = dayMeals.reduce((sum, m) => sum + m.fats, 0);
        const totalWater = dayWater.reduce((sum, w) => sum + w.amount_ml, 0);

        // Goal is considered met if within 10% range or exceeded
        const caloriesMet = totalCalories >= calorieGoal * 0.9 && totalCalories <= calorieGoal * 1.1;
        const proteinMet = totalProtein >= proteinGoal * 0.9;
        const carbsMet = totalCarbs >= carbsGoal * 0.9 && totalCarbs <= carbsGoal * 1.1;
        const fatsMet = totalFats >= fatsGoal * 0.9 && totalFats <= fatsGoal * 1.1;
        const waterMet = totalWater >= waterGoalMl;

        return {
          date,
          dayName: format(date, 'EEE'),
          calories: { value: totalCalories, goal: calorieGoal, met: caloriesMet },
          protein: { value: totalProtein, goal: proteinGoal, met: proteinMet },
          carbs: { value: totalCarbs, goal: carbsGoal, met: carbsMet },
          fats: { value: totalFats, goal: fatsGoal, met: fatsMet },
          water: { value: totalWater, goal: waterGoalMl, met: waterMet },
          allGoalsMet: caloriesMet && proteinMet && carbsMet && fatsMet && waterMet,
        };
      });

      setAchievements(dayAchievements);

      // Calculate weekly stats
      const trackedDays = dayAchievements.filter(d => d.calories.value > 0 || d.water.value > 0);
      setStats({
        perfectDays: dayAchievements.filter(d => d.allGoalsMet).length,
        calorieGoalDays: dayAchievements.filter(d => d.calories.met).length,
        proteinGoalDays: dayAchievements.filter(d => d.protein.met).length,
        carbsGoalDays: dayAchievements.filter(d => d.carbs.met).length,
        fatsGoalDays: dayAchievements.filter(d => d.fats.met).length,
        waterGoalDays: dayAchievements.filter(d => d.water.met).length,
        totalDaysTracked: trackedDays.length,
      });
    } catch (error) {
      console.error("Error loading weekly achievements:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading achievements...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          Weekly Achievements
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Perfect Days Highlight */}
        {stats && stats.perfectDays > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-3xl">🏆</span>
              <span className="text-3xl font-bold text-amber-600">{stats.perfectDays}</span>
            </div>
            <p className="text-sm font-medium text-amber-700">Perfect Days This Week!</p>
            <p className="text-xs text-muted-foreground mt-1">All goals met</p>
          </div>
        )}

        {/* Daily Achievement Grid */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Daily Breakdown</p>
          <div className="grid grid-cols-7 gap-1">
            {achievements.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{day.dayName}</p>
                <div 
                  className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center transition-all ${
                    day.allGoalsMet 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                      : day.calories.value > 0 || day.water.value > 0
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {day.allGoalsMet ? (
                    <Check className="w-4 h-4" />
                  ) : day.calories.value > 0 || day.water.value > 0 ? (
                    <span className="text-xs font-bold">
                      {Math.round(((
                        (day.calories.met ? 1 : 0) +
                        (day.protein.met ? 1 : 0) +
                        (day.carbs.met ? 1 : 0) +
                        (day.fats.met ? 1 : 0) +
                        (day.water.met ? 1 : 0)
                      ) / 5) * 100)}%
                    </span>
                  ) : (
                    <span className="text-xs">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Goal Category Stats */}
        {stats && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Goals Met This Week</p>
            <div className="grid grid-cols-2 gap-2">
              <GoalStat 
                icon={<Flame className="w-4 h-4" />}
                label="Calories"
                achieved={stats.calorieGoalDays}
                total={7}
                color="text-orange-500"
                bgColor="bg-orange-500/10"
              />
              <GoalStat 
                icon={<Target className="w-4 h-4" />}
                label="Protein"
                achieved={stats.proteinGoalDays}
                total={7}
                color="text-[hsl(var(--protein))]"
                bgColor="bg-[hsl(var(--protein))]/10"
              />
              <GoalStat 
                icon={<TrendingUp className="w-4 h-4" />}
                label="Carbs"
                achieved={stats.carbsGoalDays}
                total={7}
                color="text-[hsl(var(--carbs))]"
                bgColor="bg-[hsl(var(--carbs))]/10"
              />
              <GoalStat 
                icon={<Droplets className="w-4 h-4" />}
                label="Water"
                achieved={stats.waterGoalDays}
                total={7}
                color="text-blue-500"
                bgColor="bg-blue-500/10"
              />
            </div>
          </div>
        )}

        {/* Encouragement message */}
        {stats && (
          <div className="text-center pt-2">
            {stats.perfectDays >= 5 ? (
              <p className="text-sm text-green-600 font-medium">🌟 Outstanding week! Keep crushing it!</p>
            ) : stats.perfectDays >= 3 ? (
              <p className="text-sm text-amber-600 font-medium">💪 Great progress! You're building momentum!</p>
            ) : stats.totalDaysTracked > 0 ? (
              <p className="text-sm text-muted-foreground">📈 Every day counts. Keep tracking to see your progress!</p>
            ) : (
              <p className="text-sm text-muted-foreground">Start tracking your meals and water to see your achievements!</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface GoalStatProps {
  icon: React.ReactNode;
  label: string;
  achieved: number;
  total: number;
  color: string;
  bgColor: string;
}

const GoalStat = ({ icon, label, achieved, total, color, bgColor }: GoalStatProps) => {
  const percentage = Math.round((achieved / total) * 100);
  
  return (
    <div className={`${bgColor} rounded-xl p-3 flex items-center gap-3`}>
      <div className={`${color}`}>{icon}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className={`text-xs font-bold ${color}`}>{achieved}/{total}</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-amber-500' : 'bg-red-400'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
