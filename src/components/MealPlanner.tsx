import { useState, useEffect } from "react";
import { Calendar, ChefHat, RefreshCw, ChevronLeft, ChevronRight, Lightbulb, ShoppingCart, Download, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { UserBaseline } from "@/lib/userService";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";
import { GroceryList } from "@/components/GroceryList";
import { saveFavoriteMeal } from "@/lib/favoriteMealService";
import { saveMeal } from "@/lib/mealService";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { jsPDF } from "jspdf";
import { MealPlanCard, MealWithIngredients, MealIngredient } from "@/components/MealPlanCard";
import { MealSwapDialog } from "@/components/MealSwapDialog";
import { IngredientSwapDialog, IngredientOption } from "@/components/IngredientSwapDialog";

type Meal = MealWithIngredients;

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

// Helper to get the start of the current week (Monday)
const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

export const MealPlanner = ({ baseline }: MealPlannerProps) => {
  const { t } = useLanguage();
  const { targets: activeTargets } = useActiveNutritionTargets();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryListData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGrocery, setIsLoadingGrocery] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showGroceryList, setShowGroceryList] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [mealToSwap, setMealToSwap] = useState<{ meal: Meal; dayIndex: number; mealIndex: number } | null>(null);
  const [ingredientSwapDialogOpen, setIngredientSwapDialogOpen] = useState(false);
  const [ingredientToSwap, setIngredientToSwap] = useState<{ 
    ingredient: MealIngredient; 
    ingredientIndex: number;
    meal: Meal;
    dayIndex: number; 
    mealIndex: number;
  } | null>(null);
  
  const [isSwapping, setIsSwapping] = useState(false);
  const [mealPlanId, setMealPlanId] = useState<string | null>(null);

  // Load existing meal plan on mount
  useEffect(() => {
    loadExistingMealPlan();
  }, []);

  const loadExistingMealPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = getWeekStart();
      
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (error) {
        console.error('Error loading meal plan:', error);
        return;
      }

      if (data && data.plan_data) {
        setMealPlan(data.plan_data as unknown as MealPlan);
        setMealPlanId(data.id);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
    }
  };

  const saveMealPlan = async (plan: MealPlan) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekStart = getWeekStart();

      if (mealPlanId) {
        // Update existing
        await supabase
          .from('meal_plans')
          .update({ plan_data: JSON.parse(JSON.stringify(plan)) })
          .eq('id', mealPlanId);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('meal_plans')
          .insert([{
            user_id: user.id,
            plan_data: JSON.parse(JSON.stringify(plan)),
            week_start: weekStart
          }])
          .select('id')
          .single();

        if (!error && data) {
          setMealPlanId(data.id);
        }
      }
    } catch (error) {
      console.error('Error saving meal plan:', error);
    }
  };

  const generateMealPlan = async () => {
    if (!baseline?.target_calories && !activeTargets.calories) {
      toast.error(t('complete_questionnaire_first') || 'Please complete the questionnaire first to set your nutrition targets.');
      return;
    }

    setIsLoading(true);
    
    // Show info toast that this takes time
    toast.info(t('generating_plan_please_wait') || 'Generating your personalized meal plan... This may take up to 30 seconds.');
    
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
        proteinShakesPreference: baseline?.protein_shakes_preference,
        cookingSkill: baseline?.cooking_skill,
        mealPrepTime: baseline?.meal_prep_time,
        // Additional behavioral context
        eatingOutFrequency: baseline?.eating_out_frequency,
        snackingHabits: baseline?.snacking_habits,
        weekendHabits: baseline?.weekend_habits,
        energyPatterns: baseline?.energy_patterns,
        conditions: baseline?.conditions,
        // Unit system preference
        unitSystem: baseline?.unit_system || 'metric',
      };

      console.log('Generating meal plan with context:', userContext);

      const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { userContext }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        if (data.error.includes('Rate limit')) {
          toast.error(t('too_many_requests') || 'Too many requests. Please try again in a moment.');
        } else if (data.error.includes('credits')) {
          toast.error(t('ai_service_unavailable') || 'AI service temporarily unavailable.');
        } else if (data.error.includes('Unauthorized')) {
          toast.error(t('please_login') || 'Please log in to generate a meal plan.');
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data?.mealPlan) {
        setMealPlan(data.mealPlan);
        setMealPlanId(null); // Reset so it creates a new record
        await saveMealPlan(data.mealPlan);
        toast.success(t('meal_plan_generated') || 'Meal plan generated successfully!');
      } else {
        console.error('No meal plan in response:', data);
        toast.error(t('failed_generate_plan') || 'Failed to generate meal plan. Please try again.');
      }
    } catch (error: any) {
      console.error('Error generating meal plan:', error);
      // Check for common error types
      if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
        toast.error(t('network_error') || 'Network error. Please check your connection and try again.');
      } else if (error?.message?.includes('FunctionsFetchError')) {
        toast.error(t('service_unavailable') || 'Service temporarily unavailable. Please try again later.');
      } else {
        toast.error(t('failed_generate_plan') || 'Failed to generate meal plan. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateGroceryList = async () => {
    if (!mealPlan) return;
    
    setIsLoadingGrocery(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-grocery-list', {
        body: { 
          mealPlan,
          currency: baseline?.preferred_currency || 'GBP'
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.groceryList) {
        setGroceryList(data.groceryList);
        setShowGroceryList(true);
        toast.success(t('grocery_list_generated'));
      } else {
        toast.error(t('failed_generate_grocery'));
      }
    } catch (error) {
      console.error('Error generating grocery list:', error);
      toast.error(t('failed_generate_grocery'));
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

  // Handle ingredient quantity updates with real-time macro recalculation
  const handleMealUpdate = (dayIndex: number, mealIndex: number, updatedMeal: Meal) => {
    if (!mealPlan) return;

    const newDays = [...mealPlan.days];
    newDays[dayIndex].meals[mealIndex] = updatedMeal;

    // Recalculate day totals
    const dayMeals = newDays[dayIndex].meals;
    newDays[dayIndex].totals = {
      calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
      protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
      carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
      fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
    };

    const updatedPlan = { ...mealPlan, days: newDays };
    setMealPlan(updatedPlan);
    
    // Debounce save to avoid too many writes
    saveMealPlan(updatedPlan);
  };

  const getUserContext = () => ({
    dietType: baseline?.diet_type,
    allergies: baseline?.allergies,
    foodDislikes: baseline?.food_dislikes,
    proteinShakesPreference: baseline?.protein_shakes_preference,
    cookingSkill: baseline?.cooking_skill,
    mealPrepTime: baseline?.meal_prep_time,
    targetCalories: baseline?.target_calories,
    proteinGrams: baseline?.protein_grams,
  });

  const handleGenerateSwapOptions = async (): Promise<MealWithIngredients[]> => {
    if (!mealToSwap) return [];
    
    try {
      const { data, error } = await supabase.functions.invoke('swap-meal', {
        body: { 
          currentMeal: mealToSwap.meal,
          userPreference: 'generate_options',
          userContext: getUserContext()
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return [];
      }

      if (data.options && Array.isArray(data.options)) {
        return data.options;
      }
      
      return [];
    } catch (error) {
      console.error('Error generating swap options:', error);
      toast.error(t('failed_generate_options') || 'Failed to generate options');
      return [];
    }
  };

  const handleSwapWithCustom = async (preference: string) => {
    if (!mealToSwap || !preference.trim()) return;
    
    setIsSwapping(true);
    try {
      const { data, error } = await supabase.functions.invoke('swap-meal', {
        body: { 
          currentMeal: mealToSwap.meal,
          userPreference: preference,
          userContext: getUserContext()
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.newMeal) {
        applyMealSwap(data.newMeal);
      }
    } catch (error) {
      console.error('Error swapping meal:', error);
      toast.error(t('failed_swap_meal'));
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSelectSwapOption = (option: MealWithIngredients) => {
    applyMealSwap(option);
  };

  const applyMealSwap = async (newMeal: MealWithIngredients) => {
    if (!mealToSwap || !mealPlan) return;

    const newDays = [...mealPlan.days];
    newDays[mealToSwap.dayIndex].meals[mealToSwap.mealIndex] = newMeal;
    
    // Recalculate day totals
    const dayMeals = newDays[mealToSwap.dayIndex].meals;
    newDays[mealToSwap.dayIndex].totals = {
      calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
      protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
      carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
      fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
    };
    
    const updatedPlan = { ...mealPlan, days: newDays };
    setMealPlan(updatedPlan);
    await saveMealPlan(updatedPlan);
    
    toast.success(t('swapped_to').replace('{meal}', newMeal.name));
    setSwapDialogOpen(false);
    setMealToSwap(null);
  };

  // Ingredient swap handlers
  const handleIngredientSwap = (dayIndex: number, mealIndex: number, ingredientIndex: number) => {
    if (!mealPlan) return;
    const meal = mealPlan.days[dayIndex].meals[mealIndex];
    const ingredient = meal.ingredients?.[ingredientIndex];
    if (!ingredient) return;
    
    setIngredientToSwap({ ingredient, ingredientIndex, meal, dayIndex, mealIndex });
    setIngredientSwapDialogOpen(true);
  };

  const handleGenerateIngredientOptions = async (preference?: string): Promise<IngredientOption[]> => {
    if (!ingredientToSwap) return [];
    
    try {
      const { data, error } = await supabase.functions.invoke('swap-ingredient', {
        body: { 
          currentIngredient: ingredientToSwap.ingredient,
          mealName: ingredientToSwap.meal.name,
          mealType: ingredientToSwap.meal.type,
          userPreference: preference,
          userContext: {
            dietType: baseline?.diet_type,
            allergies: baseline?.allergies,
            foodDislikes: baseline?.food_dislikes,
            unitSystem: baseline?.unit_system,
          }
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return [];
      }

      if (data.options && Array.isArray(data.options)) {
        return data.options;
      }
      
      return [];
    } catch (error) {
      console.error('Error generating ingredient options:', error);
      toast.error('Failed to generate ingredient options');
      return [];
    }
  };

  const handleSelectIngredientOption = async (option: IngredientOption) => {
    if (!ingredientToSwap || !mealPlan) return;

    const { dayIndex, mealIndex, ingredientIndex, meal } = ingredientToSwap;
    
    // Create updated ingredients array
    const updatedIngredients = [...(meal.ingredients || [])];
    updatedIngredients[ingredientIndex] = {
      name: option.name,
      quantity: option.quantity,
      unit: option.unit,
      gramsPerUnit: option.gramsPerUnit,
      caloriesPer100g: option.caloriesPer100g,
      proteinPer100g: option.proteinPer100g,
      carbsPer100g: option.carbsPer100g,
      fatsPer100g: option.fatsPer100g,
    };
    
    // Recalculate meal macros
    const newMacros = updatedIngredients.reduce(
      (totals, ing) => {
        const totalGrams = ing.quantity * ing.gramsPerUnit;
        const multiplier = totalGrams / 100;
        return {
          calories: totals.calories + Math.round(ing.caloriesPer100g * multiplier),
          protein: totals.protein + Math.round(ing.proteinPer100g * multiplier),
          carbs: totals.carbs + Math.round(ing.carbsPer100g * multiplier),
          fats: totals.fats + Math.round(ing.fatsPer100g * multiplier),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );

    const updatedMeal: Meal = {
      ...meal,
      ingredients: updatedIngredients,
      ...newMacros,
    };

    // Update the meal plan
    const newDays = [...mealPlan.days];
    newDays[dayIndex].meals[mealIndex] = updatedMeal;
    
    // Recalculate day totals
    const dayMeals = newDays[dayIndex].meals;
    newDays[dayIndex].totals = {
      calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
      protein: dayMeals.reduce((sum, m) => sum + m.protein, 0),
      carbs: dayMeals.reduce((sum, m) => sum + m.carbs, 0),
      fats: dayMeals.reduce((sum, m) => sum + m.fats, 0),
    };
    
    const updatedPlan = { ...mealPlan, days: newDays };
    setMealPlan(updatedPlan);
    await saveMealPlan(updatedPlan);
    
    toast.success(`Swapped ${ingredientToSwap.ingredient.name} for ${option.name}`);
    setIngredientSwapDialogOpen(false);
    setIngredientToSwap(null);
  };

  const exportToPDF = () => {
    if (!mealPlan) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;
    
    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(t('weekly_meal_plan'), pageWidth / 2, yPos, { align: "center" });
    yPos += 15;
    
    mealPlan.days.forEach((day, dayIndex) => {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Day header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(day.day, 14, yPos);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${day.totals.calories} ${t('cal')} | P: ${day.totals.protein}g | C: ${day.totals.carbs}g | F: ${day.totals.fats}g`, 14, yPos + 5);
      yPos += 12;
      
      // Meals
      day.meals.forEach((meal) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${meal.type}: ${meal.name}`, 18, yPos);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        
        // Wrap description text
        const descLines = doc.splitTextToSize(meal.description, pageWidth - 40);
        doc.text(descLines, 18, yPos + 4);
        yPos += 4 + (descLines.length * 4);
        
        doc.text(`${meal.calories} ${t('cal')} | P: ${meal.protein}g | C: ${meal.carbs}g | F: ${meal.fats}g`, 18, yPos);
        yPos += 8;
      });
      
      yPos += 5;
    });
    
    // Tips on last page
    if (mealPlan.tips && mealPlan.tips.length > 0) {
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(t('meal_prep_tips'), 14, yPos);
      yPos += 7;
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      mealPlan.tips.forEach((tip) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        const tipLines = doc.splitTextToSize(`• ${tip}`, pageWidth - 28);
        doc.text(tipLines, 18, yPos);
        yPos += tipLines.length * 4 + 2;
      });
    }
    
    doc.save("meal-plan.pdf");
    toast.success(t('meal_plan_exported'));
  };

  const shareAsText = async () => {
    if (!mealPlan) return;
    
    let text = `🍽️ ${t('weekly_meal_plan').toUpperCase()}\n\n`;
    
    mealPlan.days.forEach((day) => {
      text += `📅 ${day.day.toUpperCase()}\n`;
      text += `Total: ${day.totals.calories} ${t('cal')} | P: ${day.totals.protein}g | C: ${day.totals.carbs}g | F: ${day.totals.fats}g\n\n`;
      
      day.meals.forEach((meal) => {
        text += `${meal.type}: ${meal.name}\n`;
        text += `  ${meal.calories} ${t('cal')} | P: ${meal.protein}g | C: ${meal.carbs}g | F: ${meal.fats}g\n`;
      });
      text += "\n";
    });
    
    if (mealPlan.tips && mealPlan.tips.length > 0) {
      text += `💡 ${t('meal_prep_tips').toUpperCase()}\n`;
      mealPlan.tips.forEach((tip) => {
        text += `• ${tip}\n`;
      });
    }
    
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('meal_plan_copied'));
    } catch {
      toast.error(t('failed_copy_clipboard'));
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
            <h3 className="text-lg font-bold text-foreground mb-2">{t('weekly_meal_planner')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('generate_personalized_plan')}
            </p>
            <Button 
              onClick={generateMealPlan} 
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  {t('generate_meal_plan')}
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
            {t('weekly_meal_plan')}
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={shareAsText}
              title="Copy to clipboard"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={exportToPDF}
              title="Export as PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={generateMealPlan}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
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
              <p className="text-sm font-medium text-foreground mb-2">{t('day_totals').replace('{day}', currentDay.day)}</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{currentDay.totals.calories}</p>
                  <p className="text-xs text-muted-foreground">{t('cal')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--protein))]">{currentDay.totals.protein}g</p>
                  <p className="text-xs text-muted-foreground">{t('protein')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--carbs))]">{currentDay.totals.carbs}g</p>
                  <p className="text-xs text-muted-foreground">{t('carbs')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-[hsl(var(--fats))]">{currentDay.totals.fats}g</p>
                  <p className="text-xs text-muted-foreground">{t('fats')}</p>
                </div>
              </div>
            </div>

            {/* Meals */}
            <div className="space-y-3 mb-4">
              {currentDay.meals.map((meal, mealIndex) => (
                <MealPlanCard
                  key={mealIndex}
                  meal={meal}
                  onUpdate={(updatedMeal) => handleMealUpdate(selectedDay, mealIndex, updatedMeal)}
                  onSaveToFavorites={async () => {
                    try {
                      await saveFavoriteMeal({
                        name: meal.name,
                        calories: meal.calories,
                        protein: meal.protein,
                        carbs: meal.carbs,
                        fats: meal.fats,
                        ingredients: meal.description,
                      });
                      toast.success(t('saved_to_favorites'));
                    } catch (error) {
                      toast.error("Failed to save favorite");
                    }
                  }}
                  onSwap={() => {
                    setMealToSwap({ meal, dayIndex: selectedDay, mealIndex });
                    setSwapDialogOpen(true);
                  }}
                  onSwapIngredient={(ingredientIndex) => handleIngredientSwap(selectedDay, mealIndex, ingredientIndex)}
                  onLogMeal={async () => {
                    try {
                      await saveMeal({
                        name: meal.name,
                        calories: meal.calories,
                        protein: meal.protein,
                        carbs: meal.carbs,
                        fats: meal.fats,
                      });
                      toast.success(t('meal_logged') || `${meal.name} logged successfully!`);
                    } catch (error) {
                      toast.error("Failed to log meal");
                    }
                  }}
                  getMealTypeColor={getMealTypeColor}
                />
              ))}
            </div>
          </>
        )}

        {/* Tips */}
        {mealPlan.tips && mealPlan.tips.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">{t('meal_prep_tips')}</p>
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
              {t('generating_grocery_list')}
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              {t('generate_grocery_list')}
            </>
          )}
        </Button>
      </CardContent>

      {/* Swap Meal Dialog */}
      <MealSwapDialog
        open={swapDialogOpen}
        onOpenChange={setSwapDialogOpen}
        meal={mealToSwap?.meal || null}
        onSwapWithCustom={handleSwapWithCustom}
        onSelectOption={handleSelectSwapOption}
        onGenerateOptions={handleGenerateSwapOptions}
        isLoading={isSwapping}
        getMealTypeColor={getMealTypeColor}
      />

      {/* Swap Ingredient Dialog */}
      <IngredientSwapDialog
        open={ingredientSwapDialogOpen}
        onOpenChange={setIngredientSwapDialogOpen}
        ingredient={ingredientToSwap?.ingredient || null}
        mealName={ingredientToSwap?.meal.name || ''}
        onSelectOption={handleSelectIngredientOption}
        onGenerateOptions={handleGenerateIngredientOptions}
        isLoading={isSwapping}
      />
    </Card>
  );
};