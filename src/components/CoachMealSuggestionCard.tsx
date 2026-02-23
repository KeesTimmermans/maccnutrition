import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UtensilsCrossed, Clock, Plus, Pencil, Check, Trash2 } from "lucide-react";
import { saveMeal } from "@/lib/mealService";
import { toast } from "sonner";

export interface MealSuggestion {
  type: "meal_suggestion";
  version: number;
  meal: {
    title: string;
    servings: number;
    prep_minutes?: number;
    cook_minutes?: number;
    ingredients: { item: string; amount: string }[];
    instructions?: string[];
    notes?: string[];
    estimated_macros?: {
      calories: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
    };
  };
}

export function parseMealSuggestion(content: string): MealSuggestion | null {
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed?.type === "meal_suggestion" && parsed?.meal?.title) {
        return parsed as MealSuggestion;
      }
    } catch {
      // skip malformed blocks
    }
  }
  return null;
}

export function stripMealSuggestionJson(content: string): string {
  return content.replace(/```json\s*\{[\s\S]*?"type"\s*:\s*"meal_suggestion"[\s\S]*?```/g, "").trim();
}

interface Props {
  suggestion: MealSuggestion;
  onLogged?: () => void;
}

export const CoachMealSuggestionCard = ({ suggestion, onLogged }: Props) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState(suggestion.meal.title);
  const [editServings, setEditServings] = useState(suggestion.meal.servings || 1);
  const [editSlot, setEditSlot] = useState<string>("");
  const [editPrepMin, setEditPrepMin] = useState(suggestion.meal.prep_minutes ?? 0);
  const [editCookMin, setEditCookMin] = useState(suggestion.meal.cook_minutes ?? 0);
  const [editIngredients, setEditIngredients] = useState(
    suggestion.meal.ingredients.map((i) => ({ item: i.item, amount: i.amount }))
  );
  const [editNotes, setEditNotes] = useState(
    Array.isArray(suggestion.meal.notes) ? suggestion.meal.notes.join("\n") : ""
  );

  const { meal } = suggestion;
  const totalMinutes = (meal.prep_minutes || 0) + (meal.cook_minutes || 0);
  const previewIngredients = meal.ingredients.slice(0, 3);
  const macros = meal.estimated_macros;

  const hasValidIngredients = editIngredients.some((i) => i.item.trim().length > 0);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Reset edit fields to current suggestion values
    setEditTitle(suggestion.meal.title);
    setEditServings(suggestion.meal.servings || 1);
    setEditSlot("");
    setEditPrepMin(suggestion.meal.prep_minutes ?? 0);
    setEditCookMin(suggestion.meal.cook_minutes ?? 0);
    setEditIngredients(
      suggestion.meal.ingredients.map((i) => ({ item: i.item, amount: i.amount }))
    );
    setEditNotes(
      Array.isArray(suggestion.meal.notes) ? suggestion.meal.notes.join("\n") : ""
    );
    if (import.meta.env.DEV) {
      console.log("[CoachMealSuggestionCard] onEditClick", { title: suggestion.meal.title });
    }
    setShowEditModal(true);
  };

  const updateIngredient = (index: number, field: "item" | "amount", value: string) => {
    setEditIngredients((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing))
    );
  };

  const addIngredient = () => {
    setEditIngredients((prev) => [{ item: "", amount: "" }, ...prev]);
  };

  const removeIngredient = (index: number) => {
    setEditIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const buildRecipeNotes = () => {
    const parts: string[] = [];
    if (editPrepMin > 0 || editCookMin > 0) {
      parts.push(`Prep: ${editPrepMin}min | Cook: ${editCookMin}min`);
    }
    const ingredientLines = editIngredients
      .filter((i) => i.item.trim())
      .map((i) => `• ${i.amount} ${i.item}`.trim());
    if (ingredientLines.length > 0) {
      parts.push("Ingredients:\n" + ingredientLines.join("\n"));
    }
    if (editNotes.trim()) {
      parts.push("Notes:\n" + editNotes.trim());
    }
    return parts.join("\n\n");
  };

  const handleSaveClick = async () => {
    const name = editSlot ? `${editSlot}: ${editTitle}` : editTitle;
    const notes = buildRecipeNotes();
    const payload = {
      name,
      calories: Math.round((macros?.calories || 0) * editServings),
      protein: Math.round((macros?.protein_g || 0) * editServings),
      carbs: Math.round((macros?.carbs_g || 0) * editServings),
      fats: Math.round((macros?.fat_g || 0) * editServings),
      notes: notes || undefined,
    };
    if (import.meta.env.DEV) {
      console.log("[CoachMealSuggestionCard] onSaveClick payload", payload);
    }
    setIsLogging(true);
    try {
      await saveMeal(payload);
      setLogged(true);
      setShowEditModal(false);
      toast.success("Added to your meals");
      onLogged?.();
    } catch (e) {
      console.error("Error logging meal from coach:", e);
      toast.error("Failed to log meal — please try again");
    } finally {
      setIsLogging(false);
    }
  };

  const logMealQuick = async () => {
    setIsLogging(true);
    try {
      const ingredientLines = meal.ingredients
        .map((i) => `• ${i.amount} ${i.item}`.trim());
      const quickNotes = ingredientLines.length > 0 ? "Ingredients:\n" + ingredientLines.join("\n") : undefined;

      await saveMeal({
        name: meal.title,
        calories: Math.round(macros?.calories || 0),
        protein: Math.round(macros?.protein_g || 0),
        carbs: Math.round(macros?.carbs_g || 0),
        fats: Math.round(macros?.fat_g || 0),
        notes: quickNotes,
      });
      setLogged(true);
      toast.success("Added to your meals");
      onLogged?.();
    } catch (e) {
      console.error("Error logging meal from coach:", e);
      toast.error("Failed to log meal");
    } finally {
      setIsLogging(false);
    }
  };

  if (logged) {
    return (
      <Card className="mt-2 border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2 text-sm text-primary">
          <Check className="w-4 h-4" />
          <span className="font-medium">Logged: {meal.title}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-2 border-primary/30">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="font-semibold text-sm">{meal.title}</span>
            </div>
            {totalMinutes > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <Clock className="w-3 h-3" />
                {totalMinutes}min
              </span>
            )}
          </div>

          {macros && (macros.calories || macros.protein_g) && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {macros.calories != null && <span>{macros.calories} kcal</span>}
              {macros.protein_g != null && <span>{macros.protein_g}g protein</span>}
              {macros.carbs_g != null && <span>{macros.carbs_g}g carbs</span>}
              {macros.fat_g != null && <span>{macros.fat_g}g fat</span>}
            </div>
          )}

          {previewIngredients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {previewIngredients.map((i) => `${i.amount} ${i.item}`).join(" · ")}
              {meal.ingredients.length > 3 && ` +${meal.ingredients.length - 3} more`}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={logMealQuick}
              disabled={isLogging}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add to today's log
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleEditClick}
              disabled={isLogging}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal} modal>
        <DialogContent className="max-w-md z-[200] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit before logging</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Meal name</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Servings + Slot row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Servings</label>
                <Input
                  type="number"
                  min={0.25}
                  max={10}
                  step={0.25}
                  value={editServings}
                  onChange={(e) => setEditServings(Math.max(0.25, Number(e.target.value) || 0.25))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Meal slot</label>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setEditSlot(editSlot === slot ? "" : slot)}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        editSlot === slot
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prep + Cook */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prep (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={editPrepMin}
                  onChange={(e) => setEditPrepMin(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cook (min)</label>
                <Input
                  type="number"
                  min={0}
                  value={editCookMin}
                  onChange={(e) => setEditCookMin(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ingredients</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={addIngredient}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {editIngredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <Input
                      placeholder="Amount"
                      className="w-24 h-8 text-xs flex-shrink-0"
                      value={ing.amount}
                      onChange={(e) => updateIngredient(idx, "amount", e.target.value)}
                    />
                    <Input
                      placeholder="Ingredient"
                      className="flex-1 h-8 text-xs"
                      value={ing.item}
                      onChange={(e) => updateIngredient(idx, "item", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeIngredient(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {editIngredients.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-1">No ingredients — tap Add above</p>
                )}
              </div>
              {!hasValidIngredients && editIngredients.length > 0 && (
                <p className="text-xs text-destructive mt-1">At least one ingredient name is required</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Textarea
                className="min-h-[60px] text-xs"
                placeholder="Any extra notes…"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveClick}
              disabled={isLogging || !editTitle.trim() || !hasValidIngredients}
              className="w-full"
            >
              {isLogging ? "Saving…" : "Log meal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
