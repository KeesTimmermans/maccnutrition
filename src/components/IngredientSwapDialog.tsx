import { useState } from "react";
import { RefreshCw, ChevronRight, Pencil, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MealIngredient } from "@/components/MealPlanCard";
import { useLanguage } from "@/lib/i18n";

export interface IngredientOption extends MealIngredient {
  reason?: string;
}

interface IngredientSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: MealIngredient | null;
  mealName: string;
  onSelectOption: (option: IngredientOption) => void;
  onGenerateOptions: (preference?: string) => Promise<IngredientOption[]>;
  isLoading: boolean;
}

export const IngredientSwapDialog = ({
  open,
  onOpenChange,
  ingredient,
  mealName,
  onSelectOption,
  onGenerateOptions,
  isLoading,
}: IngredientSwapDialogProps) => {
  const { t } = useLanguage();
  const [options, setOptions] = useState<IngredientOption[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPreference, setCustomPreference] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerateOptions = async (preference?: string) => {
    setIsGenerating(true);
    try {
      const result = await onGenerateOptions(preference);
      setOptions(result);
      setHasGenerated(true);
      setShowCustomInput(false);
    } catch (error) {
      console.error("Error generating ingredient options:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (option: IngredientOption) => {
    onSelectOption(option);
    resetState();
  };

  const handleCustomSwap = async () => {
    if (!customPreference.trim()) return;
    await handleGenerateOptions(customPreference);
  };

  const resetState = () => {
    setOptions([]);
    setShowCustomInput(false);
    setCustomPreference("");
    setHasGenerated(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  if (!ingredient) return null;

  // Calculate current ingredient contribution
  const currentGrams = ingredient.quantity * ingredient.gramsPerUnit;
  const currentCals = Math.round(ingredient.caloriesPer100g * currentGrams / 100);
  const currentProtein = Math.round(ingredient.proteinPer100g * currentGrams / 100);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Swap Ingredient
          </DialogTitle>
          <DialogDescription>
            Replace "{ingredient.name}" in {mealName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current ingredient info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Current ingredient</p>
            <p className="font-medium text-foreground">{ingredient.name}</p>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>{ingredient.quantity} {ingredient.unit}</span>
              <span>•</span>
              <span>{currentCals} cal</span>
              <span>•</span>
              <span>P: {currentProtein}g</span>
            </div>
          </div>

          {/* Initial choice: Generate options or custom */}
          {!hasGenerated && !showCustomInput && (
            <div className="space-y-3">
              <Button
                onClick={() => handleGenerateOptions()}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Finding alternatives...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Suggest 3 alternatives
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowCustomInput(true)}
                className="w-full gap-2"
              >
                <Pencil className="w-4 h-4" />
                I know what I want
              </Button>
            </div>
          )}

          {/* AI-generated options */}
          {hasGenerated && options.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Choose a substitute:
              </p>
              
              {options.map((option, index) => {
                const optionGrams = option.quantity * option.gramsPerUnit;
                const optionCals = Math.round(option.caloriesPer100g * optionGrams / 100);
                const optionProtein = Math.round(option.proteinPer100g * optionGrams / 100);
                
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectOption(option)}
                    disabled={isLoading}
                    className="w-full text-left bg-background border border-border rounded-xl p-3 hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground text-sm">{option.name}</h4>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{option.quantity} {option.unit}</span>
                          <span>•</span>
                          <span className="text-primary">{optionCals} cal</span>
                          <span>•</span>
                          <span>P: {optionProtein}g</span>
                        </div>
                        {option.reason && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">
                            {option.reason}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                    </div>
                  </button>
                );
              })}

              {/* Regenerate and custom options */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateOptions()}
                  disabled={isGenerating}
                  className="flex-1 gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  More options
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomInput(true)}
                  className="flex-1 gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Custom
                </Button>
              </div>
            </div>
          )}

          {/* Custom input mode */}
          {showCustomInput && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  What would you like instead?
                </label>
                <Input
                  placeholder="e.g., Something with more protein, dairy-free option..."
                  value={customPreference}
                  onChange={(e) => setCustomPreference(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSwap()}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCustomInput(false);
                    if (!hasGenerated) {
                      setCustomPreference("");
                    }
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCustomSwap}
                  disabled={isGenerating || !customPreference.trim()}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Find options"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
