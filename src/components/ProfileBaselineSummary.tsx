import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserBaseline } from "@/lib/userService";
import { updateProfileAndRecalculate } from "@/lib/userService";
import { Flame, Droplets, Target, Dumbbell, Loader2, ChevronDown, Trophy } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";

interface ProfileBaselineSummaryProps {
  baseline: UserBaseline | null;
  onBaselineUpdated?: (updated: UserBaseline) => void;
}

const GOAL_OPTIONS = [
  { value: "fat_loss", labelKey: "fat_loss", fallback: "Fat Loss", icon: "🔥" },
  { value: "muscle_gain", labelKey: "muscle_gain", fallback: "Muscle Gain", icon: "💪" },
  { value: "performance", labelKey: "performance_goal", fallback: "Performance", icon: "⚡" },
  { value: "recovery", labelKey: "recovery_goal", fallback: "Recovery", icon: "🔄" },
  { value: "energy", labelKey: "energy_goal", fallback: "Energy", icon: "✨" },
  { value: "health_markers", labelKey: "health_markers", fallback: "Health Markers", icon: "📊" },
  { value: "general_health", labelKey: "general_health", fallback: "General Health", icon: "🌿" },
] as const;

export const ProfileBaselineSummary = ({ baseline, onBaselineUpdated }: ProfileBaselineSummaryProps) => {
  const { t } = useLanguage();
  const { targets: activeTargets } = useActiveNutritionTargets();
  const [saving, setSaving] = useState(false);

  if (!baseline) return null;

  const handleGoalChange = async (newGoal: string) => {
    if (newGoal === baseline.primary_goal || saving) return;
    setSaving(true);
    try {
      const updated = await updateProfileAndRecalculate({ primary_goal: newGoal });
      if (updated) {
        onBaselineUpdated?.(updated);
        toast.success("Goal updated");
      } else {
        toast.error("Failed to update goal");
      }
    } catch (err) {
      console.error("Error updating primary goal:", err);
      toast.error("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          {t('your_targets') || 'Your Targets'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Primary Goal — Editable */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">{t('primary_goal') || 'Primary Goal'}</span>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          </div>
          <Select
            value={baseline.primary_goal || "general_health"}
            onValueChange={handleGoalChange}
            disabled={saving}
          >
            <SelectTrigger className="mx-auto w-auto min-w-[160px] bg-transparent border-primary/20 text-primary font-bold text-lg justify-center gap-2 h-auto py-1.5 [&>svg]:hidden">
              <SelectValue />
              <ChevronDown className="w-4 h-4 text-primary/60 shrink-0" />
            </SelectTrigger>
            <SelectContent>
              {GOAL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">{opt.icon} {t(opt.labelKey) || opt.fallback}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Calorie & Macro Targets */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {baseline.target_calories?.toLocaleString() || '-'}
            </p>
            <p className="text-xs text-muted-foreground">{t('cal_day') || 'cal/day'}</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Droplets className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg font-bold text-foreground">
              {baseline.water_liters?.toFixed(1) || '-'} – {baseline.water_liters_training?.toFixed(1) || '-'}L
            </p>
            <p className="text-xs text-muted-foreground">{t('water_day') || 'water/day'}</p>
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[hsl(var(--protein))]/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[hsl(var(--protein))]">
              {baseline.protein_grams || '-'}g
            </p>
            <p className="text-xs text-muted-foreground">{t('protein') || 'Protein'}</p>
          </div>
          <div className="bg-[hsl(var(--carbs))]/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[hsl(var(--carbs))]">
              {baseline.carbs_grams || '-'}g
            </p>
            <p className="text-xs text-muted-foreground">{t('carbs') || 'Carbs'}</p>
          </div>
          <div className="bg-[hsl(var(--fats))]/10 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[hsl(var(--fats))]">
              {baseline.fats_grams || '-'}g
            </p>
            <p className="text-xs text-muted-foreground">{t('fats') || 'Fats'}</p>
          </div>
        </div>

        {/* Focus Points */}
        {baseline.focus_points && baseline.focus_points.length > 0 && (
          <div className="pt-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {t('current_focus') || 'Current Focus'}
            </p>
            <div className="space-y-2">
              {baseline.focus_points.slice(0, 3).map((point, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-foreground">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};