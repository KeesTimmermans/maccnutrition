import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserBaseline } from "@/lib/userService";
import { Flame, Droplets, Target, Dumbbell } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { toDisplayLabel } from "@/lib/i18n/displayLabel";

interface ProfileBaselineSummaryProps {
  baseline: UserBaseline | null;
}

export const ProfileBaselineSummary = ({ baseline }: ProfileBaselineSummaryProps) => {
  const { t } = useLanguage();

  if (!baseline) return null;

  const goalLabels: Record<string, string> = {
    fat_loss: t('fat_loss') || 'Fat Loss',
    muscle_gain: t('muscle_gain') || 'Muscle Gain',
    performance: t('performance_goal') || 'Performance',
    recovery: t('recovery_goal') || 'Recovery',
    energy: t('energy_goal') || 'Energy',
    health_markers: t('health_markers') || 'Health Markers',
    general_health: t('general_health') || 'General Health',
    recomp: 'Body Recomposition',
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
        {/* Primary Goal */}
        {baseline.primary_goal && (
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Dumbbell className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">{t('primary_goal') || 'Primary Goal'}</span>
            </div>
            <p className="text-lg font-bold text-primary">
              {goalLabels[baseline.primary_goal] || toDisplayLabel(baseline.primary_goal)}
            </p>
          </div>
        )}

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
            <p className="text-2xl font-bold text-foreground">
              {baseline.water_liters?.toFixed(1) || '-'}L
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