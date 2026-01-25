import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Minus, UtensilsCrossed, Heart, Repeat, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";

export interface MealIngredient {
  name: string;
  quantity: number;
  unit: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  gramsPerUnit: number;
}

export interface MealWithIngredients {
  type: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients?: MealIngredient[];
}

interface MealPlanCardProps {
  meal: MealWithIngredients;
  onUpdate: (updatedMeal: MealWithIngredients) => void;
  onSaveToFavorites: () => void;
  onSwap: () => void;
  onSwapIngredient?: (ingredientIndex: number) => void;
  onLogMeal: () => void;
  getMealTypeColor: (type: string) => string;
}

export const MealPlanCard = ({
  meal,
  onUpdate,
  onSaveToFavorites,
  onSwap,
  onSwapIngredient,
  onLogMeal,
  getMealTypeColor,
}: MealPlanCardProps) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const calculateMacrosFromIngredients = (ingredients: MealIngredient[]) => {
    return ingredients.reduce(
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
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (!meal.ingredients || newQuantity < 0) return;

    const updatedIngredients = meal.ingredients.map((ing, i) =>
      i === index ? { ...ing, quantity: newQuantity } : ing
    );

    const newMacros = calculateMacrosFromIngredients(updatedIngredients);

    onUpdate({
      ...meal,
      ingredients: updatedIngredients,
      ...newMacros,
    });
  };

  const incrementQuantity = (index: number) => {
    if (!meal.ingredients) return;
    const ing = meal.ingredients[index];
    // Increment based on unit type
    let increment = 0.5; // default for pcs
    if (ing.unit === 'g' || ing.unit === 'ml') {
      increment = 10;
    } else if (ing.unit === 'oz') {
      increment = 1;
    } else if (ing.unit === 'cups') {
      increment = 0.25;
    } else if (ing.unit === 'tbsp') {
      increment = 1;
    }
    handleQuantityChange(index, Math.round((ing.quantity + increment) * 100) / 100);
  };

  const decrementQuantity = (index: number) => {
    if (!meal.ingredients) return;
    const ing = meal.ingredients[index];
    let decrement = 0.5; // default for pcs
    if (ing.unit === 'g' || ing.unit === 'ml') {
      decrement = 10;
    } else if (ing.unit === 'oz') {
      decrement = 1;
    } else if (ing.unit === 'cups') {
      decrement = 0.25;
    } else if (ing.unit === 'tbsp') {
      decrement = 1;
    }
    const newQty = Math.max(0, Math.round((ing.quantity - decrement) * 100) / 100);
    handleQuantityChange(index, newQty);
  };

  const hasIngredients = meal.ingredients && meal.ingredients.length > 0;

  return (
    <div className="bg-background border border-border rounded-xl p-3 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <Badge className={`${getMealTypeColor(meal.type)} mb-1`}>
            {meal.type}
          </Badge>
          <h4 className="font-semibold text-foreground">{meal.name}</h4>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onLogMeal}
            title={t('log_meal') || 'Log this meal'}
          >
            <UtensilsCrossed className="w-4 h-4 text-muted-foreground hover:text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onSwap}
            title={t('swap_meal')}
          >
            <Repeat className="w-4 h-4 text-muted-foreground hover:text-primary" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onSaveToFavorites}
            title={t('save_to_favorites')}
          >
            <Heart className="w-4 h-4 text-muted-foreground hover:text-primary" />
          </Button>
        </div>
      </div>

      {/* Macros summary */}
      <div className="flex gap-3 text-xs mb-2">
        <span className="text-primary font-medium">{meal.calories} {t('cal')}</span>
        <span className="text-muted-foreground">P: {meal.protein}g</span>
        <span className="text-muted-foreground">C: {meal.carbs}g</span>
        <span className="text-muted-foreground">F: {meal.fats}g</span>
      </div>

      {/* Expandable ingredients section */}
      {hasIngredients ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs text-muted-foreground h-8 px-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>{meal.ingredients!.length} ingredients - tap to adjust</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          {isExpanded && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {meal.ingredients!.map((ingredient, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-sm text-foreground truncate">
                      {ingredient.name}
                    </span>
                    {onSwapIngredient && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => onSwapIngredient(index)}
                        title="Swap this ingredient"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-muted-foreground hover:text-primary" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => decrementQuantity(index)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <div className="flex items-center gap-1 min-w-[80px] justify-center">
                      <Input
                        type="number"
                        value={ingredient.quantity}
                        onChange={(e) =>
                          handleQuantityChange(index, parseFloat(e.target.value) || 0)
                        }
                        className="w-14 h-7 text-center text-sm p-1"
                        step={
                          ingredient.unit === 'g' || ingredient.unit === 'ml' ? 10 : 
                          ingredient.unit === 'oz' ? 1 : 
                          ingredient.unit === 'cups' ? 0.25 : 
                          ingredient.unit === 'tbsp' ? 1 : 0.5
                        }
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground w-6">
                        {ingredient.unit}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => incrementQuantity(index)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {/* Per-ingredient macros breakdown */}
              <div className="pt-2 border-t border-border/50 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Per ingredient:</p>
                <div className="space-y-1 text-xs">
                  {meal.ingredients!.map((ing, index) => {
                    const totalGrams = ing.quantity * ing.gramsPerUnit;
                    const multiplier = totalGrams / 100;
                    const cals = Math.round(ing.caloriesPer100g * multiplier);
                    const protein = Math.round(ing.proteinPer100g * multiplier);
                    return (
                      <div key={index} className="flex justify-between text-muted-foreground">
                        <span className="truncate flex-1">{ing.name}</span>
                        <span className="ml-2">{cals} cal, {protein}g P</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{meal.description}</p>
      )}
    </div>
  );
};
