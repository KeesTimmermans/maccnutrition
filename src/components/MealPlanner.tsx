import { useState } from "react";
import { Calendar, ChefHat, RefreshCw, ChevronLeft, ChevronRight, Utensils, Lightbulb, ShoppingCart, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { UserBaseline } from "@/lib/userService";
import { GroceryList } from "@/components/GroceryList";
import { saveFavoriteMeal } from "@/lib/favoriteMealService";
import { toast } from "sonner";

interface Meal {
  type: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface DayPlan {
  day: string;
  meals: Meal[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

interface MealPlan {
  days: DayPlan[];
  tips: string[];
}

interface GroceryItem {
  name: string;
  quantity: string;
  notes?: string;
}

interface GroceryCategory {
  name: string;
  icon: string;
  items: GroceryItem[];
}

interface GroceryListData {
  categories: GroceryCategory[];
  estimatedCost: string;
  shoppingTips: string[];
}

interface MealPlannerProps {
  baseline: UserBaseline | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const MealPlanner = ({ baseline }: MealPlannerProps) => {
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryListData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrocery, setIsLoadingGrocery] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGroceryList, setShowGroceryList] = useState(false);

  const generateMealPlan = async () => {
    setIsLoading(true);
    try {
      const userContext = {
        primaryGoal: baseline?.primary_goal,
        targetCalories: baseline?.target_calories,
        proteinGrams: baseline?.protein_grams,
        carbsGrams: baseline?.carbs_grams,
        fatsGrams: baseline?.fats_grams,
        dietType: baseline?.diet_type,
        allergies: baseline?.allergies,
        foodDislikes: baseline?.food_dislikes,
        mealsPerDay: baseline?.meals_per_day,
        activityLevel: baseline?.activity_level,
      };

      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { userContext }
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limit')) {
          toast.error('Too many requests. Please wait a moment and try again.');
        } else if (data.error.includes('credits')) {
          toast.error('AI service temporarily unavailable.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data.mealPlan) {
        setMealPlan(data.mealPlan);
        toast.success('Meal plan generated!');
      } else {
        toast.error('Failed to generate meal plan. Please try again.');
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast.error('Failed to generate meal plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateGroceryList = async () => {
    if (!mealPlan) return;
    
    setIsLoadingGrocery(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-grocery-list', {
        body: { mealPlan }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.groceryList) {
        setGroceryList(data.groceryList);
        setShowGroceryList(true);
        toast.success('Grocery list generated!');
      } else {
        toast.error('Failed to generate grocery list.');
      }
    } catch (error) {
      console.error('Error generating grocery list:', error);
      toast.error('Failed to generate grocery list.');
    } finally {
      setIsLoadingGrocery(false);
    }
  };

  const getMealTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'breakfast': return 'bg-amber-100 text-amber-800';
      case 'lunch': return 'bg-green-100 text-green-800';
      case 'dinner': return 'bg-blue-100 text-blue-800';
      case 'snack': return 'bg-purple-100 text-purple-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!mealPlan) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Weekly Meal Planner</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a personalized 7-day meal plan based on your goals and preferences
            </p>
            <Button 
              onClick={generateMealPlan} 
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  Generate Meal Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentDay = mealPlan.days[selectedDay];

  // Show grocery list if generated
  if (showGroceryList && groceryList) {
    return (
      <GroceryList 
        groceryList={groceryList} 
        onClose={() => setShowGroceryList(false)} 
      />
    );
  }

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            Weekly Meal Plan
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={generateMealPlan}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Day selector */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDay(prev => Math.max(0, prev - 1))}
            disabled={selectedDay === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex gap-1 overflow-x-auto py-1">
            {DAYS.map((day, index) => (
              <Button
                key={day}
                variant={selectedDay === index ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedDay(index)}
                className="text-xs px-2 min-w-[40px]"
              >
                {day.slice(0, 3)}
              </Button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDay(prev => Math.min(6, prev + 1))}
            disabled={selectedDay === 6}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Daily totals */}
        {currentDay && (
          <>
            <div className="bg-muted/50 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-foreground mb-2">{currentDay.day}'s Totals</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{currentDay.totals.calories}</p>
                  <p className="text-xs text-muted-foreground">cal</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--protein))]">{currentDay.totals.protein}g</p>
                  <p className="text-xs text-muted-foreground">protein</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--carbs))]">{currentDay.totals.carbs}g</p>
                  <p className="text-xs text-muted-foreground">carbs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--fats))]">{currentDay.totals.fats}g</p>
                  <p className="text-xs text-muted-foreground">fats</p>
                </div>
              </div>
            </div>

            {/* Meals */}
            <div className="space-y-3 mb-4">
              {currentDay.meals.map((meal, index) => (
                <div key={index} className="bg-background border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge className={`${getMealTypeColor(meal.type)} mb-1`}>
                        {meal.type}
                      </Badge>
                      <h4 className="font-semibold text-foreground">{meal.name}</h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={async () => {
                        try {
                          await saveFavoriteMeal({
                            name: meal.name,
                            calories: meal.calories,
                            protein: meal.protein,
                            carbs: meal.carbs,
                            fats: meal.fats,
                            ingredients: meal.description,
                          });
                          toast.success(`${meal.name} saved to favorites!`);
                        } catch (error) {
                          toast.error("Failed to save favorite");
                        }
                      }}
                    >
                      <Heart className="w-4 h-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{meal.description}</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-primary font-medium">{meal.calories} cal</span>
                    <span className="text-muted-foreground">P: {meal.protein}g</span>
                    <span className="text-muted-foreground">C: {meal.carbs}g</span>
                    <span className="text-muted-foreground">F: {meal.fats}g</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tips */}
        {mealPlan.tips && mealPlan.tips.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Meal Prep Tips</p>
            </div>
            <ul className="space-y-1">
              {mealPlan.tips.slice(0, 3).map((tip, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-primary">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Generate Grocery List Button */}
        <Button
          onClick={generateGroceryList}
          disabled={isLoadingGrocery}
          variant="outline"
          className="w-full gap-2"
        >
          {isLoadingGrocery ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating Grocery List...
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              Generate Grocery List
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
