import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRecentUniqueMeals, saveMeal, Meal } from "@/lib/mealService";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

const QuickAddMeals = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeals, setSelectedMeals] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadRecentMeals = async () => {
      setIsLoading(true);
      try {
        const meals = await getRecentUniqueMeals(5);
        setRecentMeals(meals);
      } catch (error) {
        console.error("Error loading recent meals:", error);
        toast.error("Failed to load recent meals");
      } finally {
        setIsLoading(false);
      }
    };
    loadRecentMeals();
  }, []);

  const toggleMealSelection = (mealId: string) => {
    setSelectedMeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mealId)) {
        newSet.delete(mealId);
      } else {
        newSet.add(mealId);
      }
      return newSet;
    });
  };

  const handleLogSelectedMeals = async () => {
    if (selectedMeals.size === 0) {
      toast.error("Please select at least one meal");
      return;
    }

    setIsSubmitting(true);
    try {
      const mealsToLog = recentMeals.filter(meal => selectedMeals.has(meal.id));
      
      for (const meal of mealsToLog) {
        await saveMeal({
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
        });
      }

      toast.success(`${mealsToLog.length} meal${mealsToLog.length > 1 ? 's' : ''} logged!`);
      navigate("/");
    } catch (error) {
      console.error("Error logging meals:", error);
      toast.error("Failed to log meals");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center gap-4 py-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Quick Add Meals</h1>
            <p className="text-sm text-muted-foreground">From the last 5 days</p>
          </div>
          <Clock className="w-5 h-5 text-muted-foreground" />
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-muted-foreground">Loading recent meals...</p>
          </div>
        ) : recentMeals.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Recent Meals</h2>
            <p className="text-muted-foreground mb-6">
              You haven't logged any meals in the past 5 days.
            </p>
            <Button onClick={() => navigate("/")}>
              Go Back to Log a Meal
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Tap meals to select, then log them all at once
            </p>

            {/* Meals List */}
            <div className="space-y-3">
              {recentMeals.map((meal) => {
                const isSelected = selectedMeals.has(meal.id);
                return (
                  <button
                    key={meal.id}
                    onClick={() => toggleMealSelection(meal.id)}
                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Selection indicator */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      }`}>
                        {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                      </div>

                      {/* Meal info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{meal.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-medium text-calories">{meal.calories} cal</span>
                          <span className="text-xs text-muted-foreground">
                            P: {meal.protein}g · C: {meal.carbs}g · F: {meal.fats}g
                          </span>
                        </div>
                      </div>

                      {/* Quick add single meal button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await saveMeal({
                              name: meal.name,
                              calories: meal.calories,
                              protein: meal.protein,
                              carbs: meal.carbs,
                              fats: meal.fats,
                            });
                            toast.success(`${meal.name} logged!`);
                          } catch {
                            toast.error("Failed to log meal");
                          }
                        }}
                        className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="w-5 h-5 text-primary" />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected summary & action */}
            {selectedMeals.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border safe-area-bottom">
                <div className="container">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">
                      {selectedMeals.size} meal{selectedMeals.size > 1 ? 's' : ''} selected
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {recentMeals
                        .filter(m => selectedMeals.has(m.id))
                        .reduce((sum, m) => sum + m.calories, 0)} cal total
                    </span>
                  </div>
                  <Button 
                    onClick={handleLogSelectedMeals}
                    disabled={isSubmitting}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Log Selected Meals
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default QuickAddMeals;
