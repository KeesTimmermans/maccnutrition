import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Plus, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealCard } from "@/components/MealCard";
import { getMealsByDateRange, updateMeal, deleteMeal, saveMeal, Meal, MealInput } from "@/lib/mealService";
import { format, startOfDay, endOfDay, subDays, addDays, isToday } from "date-fns";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { MealLogger } from "@/components/MealLogger";
import { InstagramRecipeImport } from "@/components/InstagramRecipeImport";
import { useShareHandler } from "@/hooks/useShareHandler";

interface DayData {
  date: Date;
  meals: Meal[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

const MealHistory = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [days, setDays] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 6));
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showInstagramImport, setShowInstagramImport] = useState(false);
  
  // Share handler for receiving Instagram URLs from native share
  const { sharedUrl, clearSharedUrl, isReady: shareHandlerReady } = useShareHandler();

  // Auto-open Instagram import dialog when a shared URL is received
  useEffect(() => {
    if (shareHandlerReady && sharedUrl && !isLoading) {
      setShowInstagramImport(true);
    }
  }, [sharedUrl, shareHandlerReady, isLoading]);

  useEffect(() => {
    loadMeals();
  }, [startDate]);

  const loadMeals = async () => {
    setIsLoading(true);
    try {
      const endDate = addDays(startDate, 6);
      const meals = await getMealsByDateRange(
        startOfDay(startDate),
        endOfDay(endDate)
      );

      // Group meals by day
      const daysMap = new Map<string, Meal[]>();
      
      // Initialize all days in range
      for (let i = 0; i <= 6; i++) {
        const day = addDays(startDate, i);
        daysMap.set(format(day, "yyyy-MM-dd"), []);
      }

      // Add meals to their respective days
      meals.forEach(meal => {
        const dayKey = format(new Date(meal.logged_at), "yyyy-MM-dd");
        const existing = daysMap.get(dayKey) || [];
        daysMap.set(dayKey, [...existing, meal]);
      });

      // Convert to array with totals
      const daysArray: DayData[] = Array.from(daysMap.entries())
        .map(([dateStr, dayMeals]) => ({
          date: new Date(dateStr),
          meals: dayMeals.sort((a, b) => 
            new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
          ),
          totals: {
            calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
            protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
            carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
            fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
          }
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      setDays(daysArray);
    } catch (error) {
      console.error("Error loading meal history:", error);
      toast.error(t('failed_load_history'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevWeek = () => {
    setStartDate(prev => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    const nextStart = addDays(startDate, 7);
    if (nextStart <= new Date()) {
      setStartDate(nextStart);
    }
  };

  const handleEditMeal = async (editedMeal: any) => {
    try {
      await updateMeal(editedMeal.id, {
        name: editedMeal.name,
        calories: editedMeal.calories,
        protein: editedMeal.protein,
        carbs: editedMeal.carbs,
        fats: editedMeal.fats,
      });
      loadMeals();
      toast.success(t('meal_updated'));
    } catch (error) {
      toast.error(t('failed_update_meal'));
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMeal(mealId);
      loadMeals();
      toast.success(t('meal_deleted'));
    } catch (error) {
      toast.error(t('failed_delete_meal'));
    }
  };

  const handleOpenLogger = (date: Date) => {
    setSelectedDate(date);
    setLoggerOpen(true);
  };

  const handleAddMeal = async (meal: MealInput) => {
    if (!selectedDate) return;
    
    try {
      // Set the time to noon on the selected date to avoid timezone issues
      const logDate = new Date(selectedDate);
      logDate.setHours(12, 0, 0, 0);
      
      await saveMeal(meal, logDate);
      loadMeals();
      toast.success(t('meal_logged'));
      setLoggerOpen(false);
      setSelectedDate(null);
    } catch (error) {
      toast.error(t('failed_log_meal'));
    }
  };

  const endDate = addDays(startDate, 6);
  const canGoNext = addDays(startDate, 7) <= new Date();

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center gap-4 py-4">
          <button 
            onClick={() => navigate("/")}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('meal_history')}</h1>
            <p className="text-sm text-muted-foreground">{t('view_past_nutrition')}</p>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Import Instagram Recipe Button */}
        <button
          onClick={() => setShowInstagramImport(true)}
          className="w-full p-3 rounded-xl border border-dashed border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-purple-500/5 flex items-center justify-center gap-2 hover:border-pink-500/50 hover:from-pink-500/10 hover:to-purple-500/10 transition-all"
        >
          <Instagram className="w-5 h-5 text-pink-500" />
          <span className="text-sm font-medium text-foreground">Import Instagram Recipe</span>
        </button>

        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-card rounded-2xl p-4 shadow-soft">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handlePrevWeek}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="font-medium">
              {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleNextWeek}
            disabled={!canGoNext}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Days List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t('loading_history')}</div>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <div key={day.date.toISOString()} className="space-y-3">
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-foreground">
                      {isToday(day.date) ? t('today') : format(day.date, "EEEE")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {format(day.date, "MMMM d, yyyy")}
                    </p>
                  </div>
                  {day.meals.length > 0 && (
                    <div className="text-right">
                      <p className="font-bold text-calories">{day.totals.calories} cal</p>
                      <p className="text-xs text-muted-foreground">
                        P: {day.totals.protein}g · C: {day.totals.carbs}g · F: {day.totals.fats}g
                      </p>
                    </div>
                  )}
                </div>

                {/* Add Meal Button */}
                {!isToday(day.date) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenLogger(day.date)}
                    className="w-full border-dashed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add forgotten meal
                  </Button>
                )}

                {/* Meals */}
                {day.meals.length === 0 ? (
                  <div className="bg-muted/50 rounded-2xl p-6 text-center">
                    <p className="text-muted-foreground text-sm">{t('no_meals_logged_day')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {day.meals.map((meal) => (
                      <MealCard
                        key={meal.id}
                        meal={{
                          id: meal.id,
                          name: meal.name,
                          time: format(new Date(meal.logged_at), "h:mm a"),
                          calories: meal.calories,
                          protein: meal.protein,
                          carbs: meal.carbs,
                          fats: meal.fats,
                          imageUrl: meal.image_url || undefined,
                        }}
                        onEdit={handleEditMeal}
                        onDelete={handleDeleteMeal}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Meal Logger Modal */}
        {loggerOpen && selectedDate && (
          <MealLogger
            onClose={() => {
              setLoggerOpen(false);
              setSelectedDate(null);
            }}
            onSubmit={handleAddMeal}
            currentDayTotals={(() => {
              const dayData = days.find(d => 
                d.date.toDateString() === selectedDate.toDateString()
              );
              return dayData?.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 };
            })()}
          />
        )}

        {/* Instagram Recipe Import Dialog */}
        <InstagramRecipeImport
          open={showInstagramImport}
          onOpenChange={setShowInstagramImport}
          onMealLogged={loadMeals}
          initialUrl={sharedUrl}
          onInitialUrlProcessed={clearSharedUrl}
        />
      </main>
    </div>
  );
};

export default MealHistory;
