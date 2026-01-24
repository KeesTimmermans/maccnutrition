import { useState } from "react";
import { RefreshCw, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MealWithIngredients } from "@/components/MealPlanCard";
import { useLanguage } from "@/lib/i18n";

interface SwapOption {
  type: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients?: any[];
}

interface MealSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealWithIngredients | null;
  onSwapWithCustom: (preference: string) => Promise<void>;
  onSelectOption: (option: SwapOption) => void;
  onGenerateOptions: () => Promise<SwapOption[]>;
  isLoading: boolean;
  getMealTypeColor: (type: string) => string;
}

export const MealSwapDialog = ({
  open,
  onOpenChange,
  meal,
  onSwapWithCustom,
  onSelectOption,
  onGenerateOptions,
  isLoading,
  getMealTypeColor,
}: MealSwapDialogProps) => {
  const { t } = useLanguage();
  const [swapOptions, setSwapOptions] = useState<SwapOption[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPreference, setCustomPreference] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerateOptions = async () => {
    setIsGenerating(true);
    try {
      const options = await onGenerateOptions();
      setSwapOptions(options);
      setHasGenerated(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateOptions = async () => {
    setIsGenerating(true);
    try {
      const options = await onGenerateOptions();
      setSwapOptions(options);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectOption = (option: SwapOption) => {
    onSelectOption(option);
    resetState();
  };

  const handleCustomSwap = async () => {
    if (!customPreference.trim()) return;
    await onSwapWithCustom(customPreference);
    resetState();
  };

  const resetState = () => {
    setSwapOptions([]);
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

  if (!meal) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            {t('swap_meal') || 'Swap Meal'}
          </DialogTitle>
          <DialogDescription>
            {t('swap_meal_description') || `Replace "${meal.name}" with something else`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current meal info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{t('current_meal') || 'Current meal'}</p>
            <p className="font-medium text-foreground">{meal.name}</p>
            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
              <span>{meal.calories} cal</span>
              <span>P: {meal.protein}g</span>
              <span>C: {meal.carbs}g</span>
              <span>F: {meal.fats}g</span>
            </div>
          </div>

          {/* Initial choice: Generate options or custom */}
          {!hasGenerated && !showCustomInput && (
            <div className="space-y-3">
              <Button
                onClick={handleGenerateOptions}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('generating_options') || 'Generating options...'}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    {t('suggest_alternatives') || 'Suggest 3 alternatives'}
                  </>
                )}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('or') || 'or'}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowCustomInput(true)}
                className="w-full gap-2"
              >
                <Pencil className="w-4 h-4" />
                {t('specify_preference') || 'I know what I want'}
              </Button>
            </div>
          )}

          {/* AI-generated options */}
          {hasGenerated && swapOptions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                {t('choose_alternative') || 'Choose an alternative:'}
              </p>
              
              {swapOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectOption(option)}
                  disabled={isLoading}
                  className="w-full text-left bg-background border border-border rounded-xl p-3 hover:border-primary hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Badge className={`${getMealTypeColor(option.type)} mb-1 text-xs`}>
                        {option.type}
                      </Badge>
                      <h4 className="font-semibold text-foreground text-sm">{option.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {option.description}
                      </p>
                      <div className="flex gap-2 mt-2 text-xs">
                        <span className="text-primary font-medium">{option.calories} cal</span>
                        <span className="text-muted-foreground">P: {option.protein}g</span>
                        <span className="text-muted-foreground">C: {option.carbs}g</span>
                        <span className="text-muted-foreground">F: {option.fats}g</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-2" />
                  </div>
                </button>
              ))}

              {/* Regenerate and custom options */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateOptions}
                  disabled={isGenerating}
                  className="flex-1 gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  {t('show_more') || 'More options'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomInput(true)}
                  className="flex-1 gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  {t('custom') || 'Custom'}
                </Button>
              </div>
            </div>
          )}

          {/* Custom input mode */}
          {showCustomInput && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('what_would_you_like') || 'What would you like instead?'}
                </label>
                <Input
                  placeholder={t('swap_placeholder') || "e.g., Something lighter, More protein, Vegetarian option..."}
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
                  {t('back') || 'Back'}
                </Button>
                <Button
                  onClick={handleCustomSwap}
                  disabled={isLoading || !customPreference.trim()}
                  className="flex-1"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('swap') || 'Swap'
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
