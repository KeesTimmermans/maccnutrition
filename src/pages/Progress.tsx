import { useState, useEffect } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { getMealsByDateRange, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getStreaks, UserStreak } from "@/lib/streakService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Target, Flame, ClipboardCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { WeeklyAchievements } from "@/components/WeeklyAchievements";
import { StreakCard } from "@/components/StreakCard";
import { ProgressUpdateDialog } from "@/components/ProgressUpdateDialog";
import { ProgressHistory } from "@/components/ProgressHistory";
import { AppLayout } from "@/components/layout/AppLayout";
interface DayData {
  date: string;
  fullDate: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface WeekSummary {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFats: number;
  totalDays: number;
  daysOnTarget: number;
}

const Progress = () => {
  const { t } = useLanguage();
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
  const [loginStreak, setLoginStreak] = useState<UserStreak | null>(null);
  const [coachingStreak, setCoachingStreak] = useState<UserStreak | null>(null);
  const [showProgressUpdate, setShowProgressUpdate] = useState(false);
  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      
      const [userBaseline, weekMeals, monthMeals, streaks] = await Promise.all([
        getUserBaseline(),
        getMealsByDateRange(weekStart, weekEnd),
        getMealsByDateRange(subDays(today, 29), today),
        getStreaks(),
      ]);

      // Set streaks
      const login = streaks.find(s => s.streak_type === 'login');
      const coaching = streaks.find(s => s.streak_type === 'coaching');
      if (login) setLoginStreak(login);
      if (coaching) setCoachingStreak(coaching);

      setBaseline(userBaseline);
      const weekly = aggregateMealsByDay(weekMeals, 7);
      const monthly = aggregateMealsByDay(monthMeals, 30);
      setWeeklyData(weekly);
      setMonthlyData(monthly);

      // Calculate weekly summary
      const daysWithData = weekly.filter(d => d.calories > 0);
      const calorieGoal = userBaseline?.target_calories || 2000;
      const tolerance = calorieGoal * 0.1; // 10% tolerance

      setWeekSummary({
        avgCalories: daysWithData.length > 0 
          ? Math.round(daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysWithData.length)
          : 0,
        avgProtein: daysWithData.length > 0 
          ? Math.round(daysWithData.reduce((sum, d) => sum + d.protein, 0) / daysWithData.length)
          : 0,
        avgCarbs: daysWithData.length > 0 
          ? Math.round(daysWithData.reduce((sum, d) => sum + d.carbs, 0) / daysWithData.length)
          : 0,
        avgFats: daysWithData.length > 0 
          ? Math.round(daysWithData.reduce((sum, d) => sum + d.fats, 0) / daysWithData.length)
          : 0,
        totalDays: daysWithData.length,
        daysOnTarget: daysWithData.filter(d => 
          d.calories >= calorieGoal - tolerance && d.calories <= calorieGoal + tolerance
        ).length,
      });
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregateMealsByDay = (meals: Meal[], days: number): DayData[] => {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    return dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayMeals = meals.filter(m => m.logged_at.startsWith(dateStr));
      
      return {
        date: format(date, days <= 7 ? 'EEE' : 'MMM d'),
        fullDate: format(date, 'MMM d'),
        calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
        protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
        carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
        fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
      };
    });
  };

  const getTrendIcon = (current: number, target: number) => {
    const diff = current - target;
    const percentage = Math.abs(diff / target) * 100;
    
    if (percentage <= 10) return <Minus className="w-4 h-4 text-green-500" />;
    if (diff > 0) return <TrendingUp className="w-4 h-4 text-amber-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const calorieGoal = baseline?.target_calories || 2000;
  const proteinGoal = baseline?.protein_grams || 120;
  const carbsGoal = baseline?.carbs_grams || 200;
  const fatsGoal = baseline?.fats_grams || 65;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">{t('loading_progress')}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>

      <div className="p-4 space-y-6">
        {/* Consistency Streaks */}
        <StreakCard loginStreak={loginStreak} coachingStreak={coachingStreak} />

        {/* Progress Check-in Button */}
        <Button
          onClick={() => setShowProgressUpdate(true)}
          variant="outline"
          className="w-full flex items-center justify-center gap-2 py-6 rounded-2xl border-primary/30 hover:bg-primary/5"
        >
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <span className="font-medium">{t('progress_checkin') || 'Progress check-in'}</span>
        </Button>

        {/* Weekly Achievements */}
        <WeeklyAchievements />
        {/* Weekly Summary */}
        {weekSummary && (
          <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                {t('this_weeks_summary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{weekSummary.avgCalories}</p>
                  <p className="text-xs text-muted-foreground">{t('avg_cal_day')}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {getTrendIcon(weekSummary.avgCalories, calorieGoal)}
                    <span className="text-xs text-muted-foreground">{t('vs_goal').replace('{goal}', calorieGoal.toString())}</span>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame className="w-5 h-5 text-secondary" />
                    <p className="text-3xl font-bold text-secondary">{weekSummary.daysOnTarget}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('days_on_target')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('of_logged').replace('{count}', weekSummary.totalDays.toString())}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[hsl(var(--protein))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--protein))]">{weekSummary.avgProtein}g</p>
                  <p className="text-xs text-muted-foreground">{t('protein')}</p>
                </div>
                <div className="bg-[hsl(var(--carbs))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--carbs))]">{weekSummary.avgCarbs}g</p>
                  <p className="text-xs text-muted-foreground">{t('carbs')}</p>
                </div>
                <div className="bg-[hsl(var(--fats))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--fats))]">{weekSummary.avgFats}g</p>
                  <p className="text-xs text-muted-foreground">{t('fats')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Combined Chart */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-foreground">{t('nutrition_trends')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs defaultValue="weekly" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="weekly">{t('weekly')}</TabsTrigger>
                <TabsTrigger value="monthly">{t('monthly')}</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis 
                        yAxisId="calories" 
                        orientation="left"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        label={{ value: t('calories'), angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                      />
                      <YAxis 
                        yAxisId="macros" 
                        orientation="right"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        label={{ value: 'g', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'calories') return [`${value} ${t('cal')}`, t('calories')];
                          return [`${value}g`, t(name)];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="calories" dataKey="calories" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={30} />
                      <Line yAxisId="macros" type="monotone" dataKey="protein" stroke="hsl(var(--protein))" strokeWidth={2} dot={{ fill: 'hsl(var(--protein))' }} />
                      <Line yAxisId="macros" type="monotone" dataKey="carbs" stroke="hsl(var(--carbs))" strokeWidth={2} dot={{ fill: 'hsl(var(--carbs))' }} />
                      <Line yAxisId="macros" type="monotone" dataKey="fats" stroke="hsl(var(--fats))" strokeWidth={2} dot={{ fill: 'hsl(var(--fats))' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-primary" />
                    <span className="text-xs text-muted-foreground">{t('calories')} ({calorieGoal}/{t('days').slice(0, -1)})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--protein))]" />
                    <span className="text-xs text-muted-foreground">{t('protein')} ({proteinGoal}g)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--carbs))]" />
                    <span className="text-xs text-muted-foreground">{t('carbs')} ({carbsGoal}g)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--fats))]" />
                    <span className="text-xs text-muted-foreground">{t('fats')} ({fatsGoal}g)</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="monthly">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis 
                        yAxisId="calories" 
                        orientation="left"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        yAxisId="macros" 
                        orientation="right"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                        formatter={(value: number, name: string) => {
                          if (name === 'calories') return [`${value} ${t('cal')}`, t('calories')];
                          return [`${value}g`, t(name)];
                        }}
                      />
                      <Legend />
                      <Line yAxisId="calories" type="monotone" dataKey="calories" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line yAxisId="macros" type="monotone" dataKey="protein" stroke="hsl(var(--protein))" strokeWidth={2} dot={false} />
                      <Line yAxisId="macros" type="monotone" dataKey="carbs" stroke="hsl(var(--carbs))" strokeWidth={2} dot={false} />
                      <Line yAxisId="macros" type="monotone" dataKey="fats" stroke="hsl(var(--fats))" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">{t('calories')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--protein))]" />
                    <span className="text-xs text-muted-foreground">{t('protein')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--carbs))]" />
                    <span className="text-xs text-muted-foreground">{t('carbs')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-[hsl(var(--fats))]" />
                    <span className="text-xs text-muted-foreground">{t('fats')}</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Progress History */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-foreground">{t('check_in_history') || 'Check-in History'}</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ProgressHistory unitSystem={baseline?.unit_system as "imperial" | "metric" || "metric"} />
          </CardContent>
        </Card>
      </div>

      {/* Progress Update Dialog */}
      <ProgressUpdateDialog
        open={showProgressUpdate}
        onOpenChange={setShowProgressUpdate}
        baseline={baseline}
        onComplete={() => {
          setShowProgressUpdate(false);
          loadChartData();
        }}
      />
    </AppLayout>
  );
};

export default Progress;