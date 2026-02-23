import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UtensilsCrossed, Clock, Plus, Pencil, Check } from "lucide-react";
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
  // Find JSON code blocks
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
  const [editTitle, setEditTitle] = useState(suggestion.meal.title);
  const [editServings, setEditServings] = useState(suggestion.meal.servings || 1);
  const [editSlot, setEditSlot] = useState<string>("");

  const { meal } = suggestion;
  const totalMinutes = (meal.prep_minutes || 0) + (meal.cook_minutes || 0);
  const previewIngredients = meal.ingredients.slice(0, 3);
  const macros = meal.estimated_macros;

  const logMeal = async (title: string, servings: number) => {
    setIsLogging(true);
    try {
      const name = servings > 1 ? `${title} (x${servings})` : title;
      await saveMeal({
        name,
        calories: Math.round((macros?.calories || 0) * servings),
        protein: Math.round((macros?.protein_g || 0) * servings),
        carbs: Math.round((macros?.carbs_g || 0) * servings),
        fats: Math.round((macros?.fat_g || 0) * servings),
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
              onClick={() => logMeal(meal.title, 1)}
              disabled={isLogging}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add to today's log
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowEditModal(true)}
              disabled={isLogging}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit before logging</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Meal name</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Servings</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={editServings}
                onChange={(e) => setEditServings(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Meal slot (optional)</label>
              <div className="flex gap-2 flex-wrap pt-1">
                {["Breakfast", "Lunch", "Dinner", "Snack"].map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setEditSlot(editSlot === slot ? "" : slot)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
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
          <DialogFooter>
            <Button
              onClick={() => {
                const name = editSlot
                  ? `${editSlot}: ${editTitle}`
                  : editTitle;
                logMeal(name, editServings);
                setShowEditModal(false);
              }}
              disabled={isLogging || !editTitle.trim()}
              className="w-full"
            >
              Log meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
