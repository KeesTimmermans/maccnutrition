import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Flame, 
  Droplets, 
  Target, 
  Clock, 
  ChevronRight,
  Sparkles,
  TrendingUp,
  Zap,
  CheckCircle2
} from "lucide-react";
import { OnboardingData } from "./OnboardingQuestionnaire";
import { BaselineResults } from "@/lib/baselineCalculations";
import macLogo from "@/assets/mac-nutrition-logo.png";
import { useLanguage } from "@/lib/i18n";

interface BaselineSummaryProps {
  userData: OnboardingData;
  baseline: BaselineResults;
  onContinue: () => void;
}

export const BaselineSummary = ({ userData, baseline, onContinue }: BaselineSummaryProps) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"overview" | "meals" | "focus">("overview");

  const tabs = [
    { id: "overview" as const, label: t('overview'), icon: <Target className="w-4 h-4" /> },
    { id: "meals" as const, label: t('meal_plan'), icon: <Clock className="w-4 h-4" /> },
    { id: "focus" as const, label: t('focus'), icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 text-center border-b border-border">
        <img src={macLogo} alt="MAC Nutrition" className="h-12 mx-auto mb-4" style={{ mixBlendMode: 'multiply' }} />
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">{t('your_personalized_plan')}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t('baseline_ready')}
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          {t('baseline_desc')}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && (
          <OverviewTab baseline={baseline} userData={userData} t={t} />
        )}
        {activeTab === "meals" && (
          <MealsTab baseline={baseline} t={t} />
        )}
        {activeTab === "focus" && (
          <FocusTab baseline={baseline} t={t} />
        )}
      </div>

      {/* CTA */}
      <div className="p-6 border-t border-border">
        <Button variant="hero" size="lg" className="w-full" onClick={onContinue}>
          {t('start_journey')}
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          {t('plan_adapts')}
        </p>
      </div>
    </div>
  );
};

// Overview Tab
const OverviewTab = ({ baseline, userData, t }: { baseline: BaselineResults; userData: OnboardingData; t: (key: string) => string }) => {
  const goalLabels: Record<string, string> = {
    fat_loss: t('fat_loss'),
    muscle_gain: t('muscle_gain'),
    performance: t('performance_goal'),
    recovery: t('recovery_goal'),
    energy: t('energy_goal'),
    health_markers: t('health_markers'),
    general_health: t('general_health'),
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Calorie Target */}
      <div className="bg-card rounded-2xl p-5 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{t('daily_calorie_target')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('based_on_your').replace('{goal}', goalLabels[userData.primaryGoal] || t('your_goals'))}
            </p>
          </div>
        </div>
        
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-primary mb-1">
            {baseline.calories.target.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">{t('calories_per_day')}</p>
        </div>

        {baseline.calories.deficit !== 0 && (
          <div className="flex items-center justify-center gap-2 bg-accent/50 rounded-lg p-2 mt-2">
            <TrendingUp className={`w-4 h-4 ${baseline.calories.deficit > 0 ? "text-orange-500" : "text-green-500"}`} />
            <span className="text-sm text-foreground">
              {baseline.calories.deficit > 0 
                ? t('cal_deficit').replace('{amount}', String(baseline.calories.deficit))
                : t('cal_surplus').replace('{amount}', String(Math.abs(baseline.calories.deficit)))}
            </span>
          </div>
        )}
      </div>

      {/* Macro Breakdown */}
      <div className="bg-card rounded-2xl p-5 shadow-soft">
        <h3 className="font-bold text-foreground mb-4">{t('macro_breakdown')}</h3>
        
        <div className="flex justify-center mb-6">
          <CombinedMacroRing 
            protein={baseline.macros.protein.percentage}
            carbs={baseline.macros.carbs.percentage}
            fats={baseline.macros.fats.percentage}
            calories={baseline.calories.target}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MacroCard 
            label={t('protein')} 
            grams={baseline.macros.protein.grams} 
            percentage={baseline.macros.protein.percentage}
            color="bg-chart-protein"
          />
          <MacroCard 
            label={t('carbs')} 
            grams={baseline.macros.carbs.grams} 
            percentage={baseline.macros.carbs.percentage}
            color="bg-chart-carbs"
          />
          <MacroCard 
            label={t('fats')} 
            grams={baseline.macros.fats.grams} 
            percentage={baseline.macros.fats.percentage}
            color="bg-chart-fats"
          />
        </div>
      </div>

      {/* Hydration Window */}
      <div className="bg-card rounded-2xl p-5 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{t('daily_hydration')}</h3>
            <p className="text-xs text-muted-foreground">{t('water_electrolytes')}</p>
          </div>
        </div>

        {/* Hydration Window Display */}
        <div className="bg-blue-500/5 rounded-xl p-4 text-center mb-3">
          <p className="text-xs text-muted-foreground mb-1">Daily Hydration Window</p>
          <div className="text-3xl font-bold text-blue-500">
            {baseline.hydration.lowerLiters.toFixed(1)} – {baseline.hydration.upperLiters.toFixed(1)}L
          </div>
          {baseline.hydration.isHighOutputDay && (
            <div className="mt-2 inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full text-xs font-semibold">
              <Zap className="w-3 h-3" />
              High Output Day: aim for upper bound
            </div>
          )}
        </div>

        {/* Day type guidance */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-300" />
            <span className="text-muted-foreground">Rest days: aim for lower–mid range</span>
          </div>
          {baseline.hydration.hasTraining && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Training days: aim toward upper range</span>
            </div>
          )}
          {baseline.hydration.isHotClimate && (
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Hot climate: aim toward upper range</span>
            </div>
          )}
        </div>

        {/* Electrolytes */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('sodium')}</span>
            <span className="font-semibold text-foreground">{baseline.hydration.sodiumMg}mg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('magnesium')}</span>
            <span className="font-semibold text-foreground">{baseline.hydration.magnesiumMg}mg</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('potassium')}</span>
            <span className="font-semibold text-foreground">{baseline.hydration.potassiumMg}mg</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Combined Macro Ring for Overview
const CombinedMacroRing = ({ protein, carbs, fats, calories }: {
  protein: number;
  carbs: number;
  fats: number;
  calories: number;
}) => {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke lengths for each macro
  const proteinLength = (protein / 100) * circumference;
  const carbsLength = (carbs / 100) * circumference;
  const fatsLength = (fats / 100) * circumference;
  
  // Calculate offsets
  const proteinOffset = 0;
  const carbsOffset = proteinLength;
  const fatsOffset = proteinLength + carbsLength;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Protein segment */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${proteinLength} ${circumference}`}
          strokeDashoffset={-proteinOffset}
          className="stroke-chart-protein"
          strokeLinecap="round"
        />
        {/* Carbs segment */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${carbsLength} ${circumference}`}
          strokeDashoffset={-carbsOffset}
          className="stroke-chart-carbs"
          strokeLinecap="round"
        />
        {/* Fats segment */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${fatsLength} ${circumference}`}
          strokeDashoffset={-fatsOffset}
          className="stroke-chart-fats"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{calories}</span>
        <span className="text-xs text-muted-foreground">kcal</span>
      </div>
    </div>
  );
};

// Macro Card Component
const MacroCard = ({ label, grams, percentage, color }: { 
  label: string; 
  grams: number; 
  percentage: number;
  color: string;
}) => (
  <div className="text-center">
    <div className={`w-3 h-3 rounded-full ${color} mx-auto mb-2`} />
    <div className="text-lg font-bold text-foreground">{grams}g</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-xs text-muted-foreground">{percentage}%</div>
  </div>
);

// Meals Tab
const MealsTab = ({ baseline, t }: { baseline: BaselineResults; t: (key: string) => string }) => (
  <div className="space-y-4 animate-slide-up">
    <div className="bg-accent/30 rounded-xl p-4 mb-6">
      <p className="text-sm text-foreground">
        {t('meal_times_suggestion')}
      </p>
    </div>

    {baseline.mealPattern.map((meal, index) => (
      <div 
        key={meal.meal}
        className="bg-card rounded-2xl p-4 shadow-soft flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
          {index + 1}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-foreground">{meal.meal}</h4>
            <span className="text-sm text-muted-foreground">{meal.time}</span>
          </div>
          <p className="text-sm text-muted-foreground">{meal.purpose}</p>
        </div>
      </div>
    ))}
  </div>
);

// Focus Tab
const FocusTab = ({ baseline, t }: { baseline: BaselineResults; t: (key: string) => string }) => (
  <div className="space-y-4 animate-slide-up">
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 mb-6">
      <h3 className="font-bold text-foreground mb-2">{t('this_weeks_focus')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('focus_habits_desc')}
      </p>
    </div>

    {baseline.focusPoints.map((point, index) => (
      <div 
        key={index}
        className="bg-card rounded-2xl p-4 shadow-soft flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-medium">{point}</p>
        </div>
      </div>
    ))}

    {/* Quick Start Guide */}
    <div className="bg-card rounded-2xl p-5 shadow-soft mt-6">
      <div className="flex items-center gap-3 mb-3">
        <Target className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">{t('quick_start_guide')}</h4>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">1.</span>
          <span>{t('guide_step_1')}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">2.</span>
          <span>{t('guide_step_2')}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">3.</span>
          <span>{t('guide_step_3')}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">4.</span>
          <span>{t('guide_step_4')}</span>
        </div>
      </div>
    </div>

    <div className="bg-card rounded-2xl p-5 shadow-soft mt-4">
      <div className="flex items-center gap-3 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">{t('remember')}</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('consistency_message')}
      </p>
    </div>
  </div>
);

export type { BaselineSummaryProps };
