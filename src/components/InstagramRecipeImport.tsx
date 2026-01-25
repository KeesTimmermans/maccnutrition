import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Instagram, Loader2, ChefHat, Plus, Minus, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveMeal, MealInput } from "@/lib/mealService";
import { toast } from "sonner";

interface Ingredient {
  name: string;
  amount: string;
  estimatedGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface ParsedRecipe {
  name: string;
  servings: number;
  ingredients: Ingredient[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  notes: string;
  confidence: string;
}

interface InstagramRecipeImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMealLogged?: () => void;
  initialUrl?: string | null;
  onInitialUrlProcessed?: () => void;
}

export const InstagramRecipeImport = ({ open, onOpenChange, onMealLogged, initialUrl, onInitialUrlProcessed }: InstagramRecipeImportProps) => {
  const [captionText, setCaptionText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [servings, setServings] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const handleImport = async () => {
    if (!captionText.trim()) {
      toast.error("Please paste the recipe caption");
      return;
    }

    setIsLoading(true);
    setRecipe(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-instagram-recipe', {
        body: { captionText: captionText.trim() }
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || "Failed to parse recipe");
        return;
      }

      setRecipe(data.recipe);
      setEditedIngredients(data.recipe.ingredients);
      setServings(data.recipe.servings || 1);
      toast.success("Recipe parsed successfully!");
      onInitialUrlProcessed?.();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Failed to parse recipe. Please try again.");
      onInitialUrlProcessed?.();
    } finally {
      setIsLoading(false);
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: number | string) => {
    const updated = [...editedIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setEditedIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setEditedIngredients(editedIngredients.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    return editedIngredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + (ing.calories || 0),
        protein: acc.protein + (ing.protein || 0),
        carbs: acc.carbs + (ing.carbs || 0),
        fats: acc.fats + (ing.fats || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  };

  const handleLogMeal = async () => {
    if (!recipe) return;

    setIsSaving(true);
    try {
      const totals = calculateTotals();
      const mealInput: MealInput = {
        name: recipe.name,
        calories: Math.round(totals.calories / servings),
        protein: Math.round(totals.protein / servings),
        carbs: Math.round(totals.carbs / servings),
        fats: Math.round(totals.fats / servings),
      };

      await saveMeal(mealInput);
      toast.success("Meal logged successfully!");
      onMealLogged?.();
      handleClose();
    } catch (error) {
      console.error("Error saving meal:", error);
      toast.error("Failed to log meal");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCaptionText("");
    setRecipe(null);
    setEditedIngredients([]);
    setServings(1);
    onOpenChange(false);
  };

  const totals = recipe ? calculateTotals() : null;
  const perServing = totals ? {
    calories: Math.round(totals.calories / servings),
    protein: Math.round(totals.protein / servings),
    carbs: Math.round(totals.carbs / servings),
    fats: Math.round(totals.fats / servings),
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-500" />
            Import Recipe
          </DialogTitle>
          <DialogDescription>
            Paste the recipe caption or ingredients list and we'll extract the macros for you.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!recipe ? (
            <div className="space-y-4 pb-4">
              <Textarea
                placeholder="Paste the recipe caption here...&#10;&#10;Example:&#10;🍳 High Protein Pancakes&#10;- 2 eggs&#10;- 1 banana&#10;- 40g oats&#10;- 1 scoop protein powder"
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                disabled={isLoading}
                className="min-h-[150px] resize-none"
              />
              
              <Button 
                onClick={handleImport} 
                disabled={isLoading || !captionText.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze Recipe"
                )}
              </Button>

              {isLoading && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Extracting ingredients and calculating macros...</p>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium mb-2">💡 Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Copy the full caption from Instagram</li>
                  <li>Include ingredient amounts for best results</li>
                  <li>Works with any recipe text format</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* Recipe Header */}
              <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-pink-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{recipe.name}</h3>
                    <Badge variant={recipe.confidence === 'high' ? 'default' : 'secondary'} className="text-xs mt-1">
                      {recipe.confidence} confidence
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Single Portion Summary - Highlighted */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  🍽️ Per Single Portion
                </h4>
                {perServing && (
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-background/80 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xl font-bold text-orange-500">{perServing.calories}</p>
                      <p className="text-xs text-muted-foreground">kcal</p>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xl font-bold text-red-500">{perServing.protein}g</p>
                      <p className="text-xs text-muted-foreground">Protein</p>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xl font-bold text-yellow-500">{perServing.carbs}g</p>
                      <p className="text-xs text-muted-foreground">Carbs</p>
                    </div>
                    <div className="bg-background/80 rounded-lg p-2.5 shadow-sm">
                      <p className="text-xl font-bold text-blue-500">{perServing.fats}g</p>
                      <p className="text-xs text-muted-foreground">Fats</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Servings Adjuster */}
              <div className="flex items-center justify-between bg-card rounded-lg p-3 border">
                <div>
                  <span className="text-sm font-medium">Number of Portions</span>
                  <p className="text-xs text-muted-foreground">Adjust to match what you'll eat</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setServings(Math.max(1, servings - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold w-8 text-center text-lg">{servings}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => setServings(servings + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Ingredients List */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  📝 Ingredients
                  <Badge variant="outline" className="text-xs">{editedIngredients.length}</Badge>
                </h4>
                <p className="text-xs text-muted-foreground mb-3">Tap any value to edit it</p>
                <div className="space-y-2">
                  {editedIngredients.map((ing, idx) => (
                    <div key={idx} className="bg-muted/50 rounded-lg p-3 text-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{ing.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="text"
                              value={ing.amount}
                              onChange={(e) => updateIngredient(idx, 'amount', e.target.value)}
                              className="h-6 text-xs w-24 px-2"
                              placeholder="Amount"
                            />
                            <span className="text-xs text-muted-foreground">({ing.estimatedGrams}g)</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeIngredient(idx)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={ing.calories}
                            onChange={(e) => updateIngredient(idx, 'calories', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs text-center"
                          />
                          <p className="text-center text-muted-foreground">cal</p>
                        </div>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={ing.protein}
                            onChange={(e) => updateIngredient(idx, 'protein', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs text-center"
                          />
                          <p className="text-center text-muted-foreground">P (g)</p>
                        </div>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={ing.carbs}
                            onChange={(e) => updateIngredient(idx, 'carbs', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs text-center"
                          />
                          <p className="text-center text-muted-foreground">C (g)</p>
                        </div>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={ing.fats}
                            onChange={(e) => updateIngredient(idx, 'fats', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs text-center"
                          />
                          <p className="text-center text-muted-foreground">F (g)</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {recipe.notes && (
                <div className="bg-amber-500/10 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{recipe.notes}</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {recipe && (
          <div className="flex-shrink-0 flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleLogMeal} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Log {servings > 1 ? `${servings} Portions` : '1 Portion'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
