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
import { calculateBaseline, BaselineResults } from "@/lib/baselineCalculations";
import cjtLogo from "@/assets/cjt-logo.png";

interface BaselineSummaryProps {
  userData: OnboardingData;
  onContinue: () => void;
}

export const BaselineSummary = ({ userData, onContinue }: BaselineSummaryProps) => {
  const [activeTab, setActiveTab] = useState<"overview" | "meals" | "focus">("overview");
  const baseline = calculateBaseline(userData);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: <Target className="w-4 h-4" /> },
    { id: "meals" as const, label: "Meal Plan", icon: <Clock className="w-4 h-4" /> },
    { id: "focus" as const, label: "Focus", icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 text-center border-b border-border">
        <img src={cjtLogo} alt="CJT Nutrition" className="h-10 mx-auto mb-4" />
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">Your Personalized Plan</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Your Baseline is Ready!
        </h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Based on your responses, here's your personalized starting point for achieving your goals.
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
          <OverviewTab baseline={baseline} userData={userData} />
        )}
        {activeTab === "meals" && (
          <MealsTab baseline={baseline} />
        )}
        {activeTab === "focus" && (
          <FocusTab baseline={baseline} />
        )}
      </div>

      {/* CTA */}
      <div className="p-6 border-t border-border">
        <Button variant="hero" size="lg" className="w-full" onClick={onContinue}>
          Start Your Journey
          <ChevronRight className="w-5 h-5 ml-1" />
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Your plan adapts as you log meals and check in
        </p>
      </div>
    </div>
  );
};

// Overview Tab
const OverviewTab = ({ baseline, userData }: { baseline: BaselineResults; userData: OnboardingData }) => {
  const goalLabels: Record<string, string> = {
    fat_loss: "Fat Loss",
    muscle_gain: "Muscle Gain",
    performance: "Performance",
    recovery: "Recovery",
    energy: "Energy",
    health_markers: "Health Markers",
    general_health: "General Health",
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
            <h3 className="font-bold text-foreground">Daily Calorie Target</h3>
            <p className="text-xs text-muted-foreground">
              Based on your {goalLabels[userData.primaryGoal] || "goals"}
            </p>
          </div>
        </div>
        
        <div className="text-center py-4">
          <div className="text-5xl font-bold text-primary mb-1">
            {baseline.calories.target.toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground">calories per day</p>
        </div>

        {baseline.calories.deficit !== 0 && (
          <div className="flex items-center justify-center gap-2 bg-accent/50 rounded-lg p-2 mt-2">
            <TrendingUp className={`w-4 h-4 ${baseline.calories.deficit > 0 ? "text-orange-500" : "text-green-500"}`} />
            <span className="text-sm text-foreground">
              {baseline.calories.deficit > 0 
                ? `${baseline.calories.deficit} cal deficit from maintenance` 
                : `${Math.abs(baseline.calories.deficit)} cal surplus for growth`}
            </span>
          </div>
        )}
      </div>

      {/* Macro Breakdown */}
      <div className="bg-card rounded-2xl p-5 shadow-soft">
        <h3 className="font-bold text-foreground mb-4">Macro Breakdown</h3>
        
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
            label="Protein" 
            grams={baseline.macros.protein.grams} 
            percentage={baseline.macros.protein.percentage}
            color="bg-chart-protein"
          />
          <MacroCard 
            label="Carbs" 
            grams={baseline.macros.carbs.grams} 
            percentage={baseline.macros.carbs.percentage}
            color="bg-chart-carbs"
          />
          <MacroCard 
            label="Fats" 
            grams={baseline.macros.fats.grams} 
            percentage={baseline.macros.fats.percentage}
            color="bg-chart-fats"
          />
        </div>
      </div>

      {/* Hydration */}
      <div className="bg-card rounded-2xl p-5 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Daily Hydration</h3>
            <p className="text-xs text-muted-foreground">Water & electrolytes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {baseline.hydration.waterLiters.toFixed(1)}L
            </div>
            <p className="text-xs text-muted-foreground">Water</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sodium</span>
              <span className="font-semibold text-foreground">{baseline.hydration.sodiumMg}mg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Magnesium</span>
              <span className="font-semibold text-foreground">{baseline.hydration.magnesiumMg}mg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potassium</span>
              <span className="font-semibold text-foreground">{baseline.hydration.potassiumMg}mg</span>
            </div>
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
const MealsTab = ({ baseline }: { baseline: BaselineResults }) => (
  <div className="space-y-4 animate-slide-up">
    <div className="bg-accent/30 rounded-xl p-4 mb-6">
      <p className="text-sm text-foreground">
        These meal times are suggestions based on your lifestyle. Feel free to adjust them — your daily targets stay the same.
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
const FocusTab = ({ baseline }: { baseline: BaselineResults }) => (
  <div className="space-y-4 animate-slide-up">
    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-5 mb-6">
      <h3 className="font-bold text-foreground mb-2">This Week's Focus</h3>
      <p className="text-sm text-muted-foreground">
        These are your personalized behavioral anchors. Focus on these habits to build a strong foundation.
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
        <h4 className="font-semibold text-foreground">Quick Start Guide</h4>
      </div>
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">1.</span>
          <span>Log meals by tapping the + button on your dashboard</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">2.</span>
          <span>Track water intake throughout the day</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">3.</span>
          <span>Chat with your AI coach for personalized guidance</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-bold text-primary">4.</span>
          <span>Check your progress charts to see trends over time</span>
        </div>
      </div>
    </div>

    <div className="bg-card rounded-2xl p-5 shadow-soft mt-4">
      <div className="flex items-center gap-3 mb-3">
        <Sparkles className="w-5 h-5 text-primary" />
        <h4 className="font-semibold text-foreground">Remember</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        Consistency over perfection. The app adapts daily — your goal is progress, not perfection. Each check-in helps refine your plan.
      </p>
    </div>
  </div>
);

export type { BaselineSummaryProps };
