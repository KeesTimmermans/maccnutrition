import { useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecalibrationResult, applyRecalibration } from "@/lib/baselineRecalibration";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface RecalibrationNotificationProps {
  result: RecalibrationResult;
  currentCalories: number;
  onApply: () => void;
  onDismiss: () => void;
}

export const RecalibrationNotification = ({
  result,
  currentCalories,
  onApply,
  onDismiss,
}: RecalibrationNotificationProps) => {
  const { t } = useLanguage();
  const [isApplying, setIsApplying] = useState(false);

  if (!result.shouldRecalibrate || !result.newBaseline) {
    return null;
  }

  const calorieChange = result.newBaseline.targetCalories - currentCalories;
  const isIncrease = calorieChange > 0;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const success = await applyRecalibration(result);
      if (success) {
        toast.success("Baseline updated! Your new targets are active.", { duration: 5000 });
        onApply();
      } else {
        toast.error("Failed to update baseline. Please try again.");
      }
    } catch (error) {
      console.error("Error applying recalibration:", error);
      toast.error("Failed to update baseline.");
    }
    setIsApplying(false);
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Baseline Recalibration Ready</h3>
            <p className="text-xs text-muted-foreground">
              Based on {result.daysSinceLastUpdate} days of data ({Math.round(result.adherenceRate * 100)}% adherence)
            </p>
          </div>
        </div>
        <button 
          onClick={onDismiss}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Changes Summary */}
      <div className="bg-background/80 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Calorie Target</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">{currentCalories}</span>
            {isIncrease ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-orange-500" />
            )}
            <span className="font-bold text-foreground">{result.newBaseline.targetCalories}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isIncrease ? "bg-green-500/10 text-green-600" : "bg-orange-500/10 text-orange-600"
            }`}>
              {isIncrease ? "+" : ""}{calorieChange} kcal
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <span className="font-semibold text-foreground">{result.newBaseline.proteinGrams}g</span>
            <p className="text-xs text-muted-foreground">Protein</p>
          </div>
          <div className="text-center">
            <span className="font-semibold text-foreground">{result.newBaseline.carbsGrams}g</span>
            <p className="text-xs text-muted-foreground">Carbs</p>
          </div>
          <div className="text-center">
            <span className="font-semibold text-foreground">{result.newBaseline.fatsGrams}g</span>
            <p className="text-xs text-muted-foreground">Fats</p>
          </div>
        </div>
      </div>

      {/* Reasons */}
      {result.adjustments.reason.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">WHY THIS CHANGE</p>
          <div className="space-y-2">
            {result.adjustments.reason.map((reason, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="soft"
          size="sm"
          onClick={onDismiss}
          className="flex-1"
        >
          Keep Current
        </Button>
        <Button
          variant="hero"
          size="sm"
          onClick={handleApply}
          disabled={isApplying}
          className="flex-1"
        >
          {isApplying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4 mr-1" />
              Apply Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
