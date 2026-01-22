import { useState, useEffect } from "react";
import { Clock, Plus, Loader2 } from "lucide-react";
import { getRecentUniqueMeals, Meal } from "@/lib/mealService";

interface QuickMealsProps {
  onSelectMeal: (meal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => void;
}

export const QuickMeals = ({ onSelectMeal }: QuickMealsProps) => {
  const [recentMeals, setRecentMeals] = useState<Meal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentMeals = async () => {
      setIsLoading(true);
      try {
        const meals = await getRecentUniqueMeals(5);
        setRecentMeals(meals);
      } catch (error) {
        console.error("Error loading recent meals:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRecentMeals();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (recentMeals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Quick Add (Last 5 Days)</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {recentMeals.map((meal) => (
          <button
            key={meal.id}
            onClick={() => onSelectMeal({
              name: meal.name,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fats: meal.fats,
            })}
            className="flex items-center gap-2 px-3 py-2 bg-muted/50 hover:bg-muted border border-border rounded-xl transition-colors group"
          >
            <span className="text-sm text-foreground truncate max-w-[150px]">{meal.name}</span>
            <span className="text-xs text-muted-foreground">{meal.calories}cal</span>
            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};