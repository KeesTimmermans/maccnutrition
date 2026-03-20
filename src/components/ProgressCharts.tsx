import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { getMealsByDateRange, Meal } from "@/lib/mealService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";

interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export const ProgressCharts = () => {
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [monthlyData, setMonthlyData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { targets: activeTargets, loading: targetsLoading } = useActiveNutritionTargets();

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      
      const [weekMeals, monthMeals] = await Promise.all([
        getMealsByDateRange(weekStart, weekEnd),
        getMealsByDateRange(subDays(today, 29), today),
      ]);

      setWeeklyData(aggregateMealsByDay(weekMeals, 7));
      setMonthlyData(aggregateMealsByDay(monthMeals, 30));
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
        calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
        protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
        carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
        fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
      };
    });
  };

  if (isLoading || targetsLoading) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading charts...
        </CardContent>
      </Card>
    );
  }

  const calorieGoal = activeTargets.calories;

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-foreground">Progress Trends</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Calories</p>
              <div className="h-[180px]">
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
                    />
                    <Bar 
                      dataKey="calories" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Goal: {calorieGoal} cal/day
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Macros</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="protein" stroke="hsl(var(--protein))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="carbs" stroke="hsl(var(--carbs))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="fats" stroke="hsl(var(--fats))" strokeWidth={2} dot={{ r: 3 }} />
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

          <TabsContent value="monthly" className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Calories (30 days)</p>
              <div className="h-[180px]">
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
                    />
                    <Line type="monotone" dataKey="calories" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Macros (30 days)</p>
              <div className="h-[180px]">
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
  );
};