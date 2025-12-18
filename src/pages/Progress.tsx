import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { getMealsByDateRange, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Flame } from "lucide-react";

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
  const navigate = useNavigate();
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      
      const [userBaseline, weekMeals, monthMeals] = await Promise.all([
        getUserBaseline(),
        getMealsByDateRange(weekStart, weekEnd),
        getMealsByDateRange(subDays(today, 29), today),
      ]);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading progress data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center gap-4 py-4">
          <button 
            onClick={() => navigate("/")}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Progress</h1>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Weekly Summary */}
        {weekSummary && (
          <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                This Week's Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{weekSummary.avgCalories}</p>
                  <p className="text-xs text-muted-foreground">avg cal/day</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {getTrendIcon(weekSummary.avgCalories, calorieGoal)}
                    <span className="text-xs text-muted-foreground">vs {calorieGoal} goal</span>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Flame className="w-5 h-5 text-secondary" />
                    <p className="text-3xl font-bold text-secondary">{weekSummary.daysOnTarget}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">days on target</p>
                  <p className="text-xs text-muted-foreground mt-1">of {weekSummary.totalDays} logged</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[hsl(var(--protein))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--protein))]">{weekSummary.avgProtein}g</p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div className="bg-[hsl(var(--carbs))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--carbs))]">{weekSummary.avgCarbs}g</p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div className="bg-[hsl(var(--fats))]/10 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-[hsl(var(--fats))]">{weekSummary.avgFats}g</p>
                  <p className="text-xs text-muted-foreground">fats</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-foreground">Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs defaultValue="weekly" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly" className="space-y-6">
                {/* Calorie Chart */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">Calories</p>
                    <p className="text-xs text-muted-foreground">Goal: {calorieGoal}/day</p>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number) => [`${value} cal`, 'Calories']}
                        />
                        <Bar 
                          dataKey="calories" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Macro Chart */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Macros</p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string) => [`${value}g`, name]}
                        />
                        <Area type="monotone" dataKey="protein" stackId="1" stroke="hsl(var(--protein))" fill="hsl(var(--protein))" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="carbs" stackId="1" stroke="hsl(var(--carbs))" fill="hsl(var(--carbs))" fillOpacity={0.6} />
                        <Area type="monotone" dataKey="fats" stackId="1" stroke="hsl(var(--fats))" fill="hsl(var(--fats))" fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--protein))]" />
                      <span className="text-xs text-muted-foreground">Protein ({proteinGoal}g)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--carbs))]" />
                      <span className="text-xs text-muted-foreground">Carbs ({carbsGoal}g)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--fats))]" />
                      <span className="text-xs text-muted-foreground">Fats ({fatsGoal}g)</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="monthly" className="space-y-6">
                {/* Monthly Calorie Chart */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">Calories (30 days)</p>
                    <p className="text-xs text-muted-foreground">Goal: {calorieGoal}/day</p>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                          formatter={(value: number) => [`${value} cal`, 'Calories']}
                        />
                        <Line type="monotone" dataKey="calories" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Monthly Macro Chart */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Macros (30 days)</p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                          formatter={(value: number, name: string) => [`${value}g`, name]}
                        />
                        <Line type="monotone" dataKey="protein" stroke="hsl(var(--protein))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="carbs" stroke="hsl(var(--carbs))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="fats" stroke="hsl(var(--fats))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--protein))]" />
                      <span className="text-xs text-muted-foreground">Protein</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--carbs))]" />
                      <span className="text-xs text-muted-foreground">Carbs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-[hsl(var(--fats))]" />
                      <span className="text-xs text-muted-foreground">Fats</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="container flex justify-around py-3">
          {[
            { icon: "🏠", label: "Home", path: "/" },
            { icon: "📊", label: "Progress", path: "/progress" },
            { icon: "🍽️", label: "Meals", path: "/history" },
            { icon: "👤", label: "Profile", path: "/" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
                item.path === "/progress" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Progress;
