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
import { UtensilsCrossed, Clock, Plus, Pencil, Check, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { saveMeal } from "@/lib/mealService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LogPayloadItem {
  ingredient: string;
  quantity: number;
  unit: string;
  brand?: string;
}

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
    log_payload?: LogPayloadItem[];
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

/** Compute macros from log_payload using our analyze-food edge function */
async function computeMacrosFromPayload(
  payload: LogPayloadItem[]
): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };

  // Build a single description of all ingredients for batch analysis
  const description = payload
    .map((p) => `${p.quantity}${p.unit} ${p.ingredient}`)
    .join(", ");

  try {
    const { data, error } = await supabase.functions.invoke("analyze-food", {
      body: { searchQuery: description, mode: "parse_meal" },
    });

    if (error) throw error;

    // parse_meal returns { ingredients: [...], mealName, confidence }
    if (data?.ingredients && Array.isArray(data.ingredients)) {
      for (const ing of data.ingredients) {
        const grams = ing.estimatedGrams || 0;
        totals.calories += Math.round((ing.caloriesPer100g || 0) * grams / 100);
        totals.protein += Math.round((ing.proteinPer100g || 0) * grams / 100);
        totals.carbs += Math.round((ing.carbsPer100g || 0) * grams / 100);
        totals.fats += Math.round((ing.fatsPer100g || 0) * grams / 100);
      }
    }
  } catch (err) {
    console.error("computeMacrosFromPayload failed:", err);
  }

  return totals;
}

interface Props {
  suggestion: MealSuggestion;
  onLogged?: () => void;
}

export const CoachMealSuggestionCard = ({ suggestion, onLogged }: Props) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [showZeroMacroWarning, setShowZeroMacroWarning] = useState(false);

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

  const hasLogPayload = meal.log_payload && meal.log_payload.length > 0;

  /** Resolve macros: try log_payload first, fall back to estimated_macros */
  const resolveMacros = async (
    servingsMultiplier: number
  ): Promise<{ calories: number; protein: number; carbs: number; fats: number }> => {
    // 1. Try computing from structured log_payload
    if (hasLogPayload) {
      const scaled = meal.log_payload!.map((p) => ({
        ...p,
        quantity: Math.round(p.quantity * servingsMultiplier),
      }));
      const computed = await computeMacrosFromPayload(scaled);
      if (computed.calories > 0 || computed.protein > 0) {
        return computed;
      }
    }

    // 2. Fall back to estimated_macros from AI
    const est = {
      calories: Math.round((macros?.calories || 0) * servingsMultiplier),
      protein: Math.round((macros?.protein_g || 0) * servingsMultiplier),
      carbs: Math.round((macros?.carbs_g || 0) * servingsMultiplier),
      fats: Math.round((macros?.fat_g || 0) * servingsMultiplier),
    };

    return est;
  };

  const isAllZero = (m: { calories: number; protein: number; carbs: number; fats: number }) =>
    m.calories === 0 && m.protein === 0 && m.carbs === 0 && m.fats === 0;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

    setIsLogging(true);
    setShowZeroMacroWarning(false);

    try {
      const resolved = await resolveMacros(editServings);

      if (isAllZero(resolved)) {
        setShowZeroMacroWarning(true);
        setIsLogging(false);
        return;
      }

      await saveMeal({
        name,
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fats: resolved.fats,
        notes: notes || undefined,
      });
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
    setShowZeroMacroWarning(false);

    try {
      const resolved = await resolveMacros(1);

      if (isAllZero(resolved)) {
        // Can't log zeros — open edit modal so user can confirm ingredients
        setShowZeroMacroWarning(true);
        setShowEditModal(true);
        setIsLogging(false);
        return;
      }

      const ingredientLines = meal.ingredients
        .map((i) => `• ${i.amount} ${i.item}`.trim());
      const quickNotes = ingredientLines.length > 0 ? "Ingredients:\n" + ingredientLines.join("\n") : undefined;

      await saveMeal({
        name: meal.title,
        calories: resolved.calories,
        protein: resolved.protein,
        carbs: resolved.carbs,
        fats: resolved.fats,
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
              {isLogging ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
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
            {/* Zero-macro warning */}
            {showZeroMacroWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-xs text-destructive">
                  <p className="font-medium">Couldn't calculate macros for this meal.</p>
                  <p className="mt-1">Please confirm or edit the ingredients below, then try again. Meals with 0 macros cannot be saved.</p>
                </div>
              </div>
            )}

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
              {isLogging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Calculating macros…
                </>
              ) : (
                "Log meal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
