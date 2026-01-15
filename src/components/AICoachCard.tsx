import { useState } from "react";
import { 
  Bot, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Zap, 
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Battery,
  Moon,
  Brain,
  Smile,
  Droplets,
  Utensils,
  Activity,
  Flame,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { CheckInAnalysis, DailyCheckIn } from "@/lib/checkinService";
import { UserBaseline } from "@/lib/userService";

interface InsightCard {
  type: "positive" | "warning" | "action" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  priority: number;
}

interface AICoachCardProps {
  greeting?: string;
  insights: string[];
  tip?: string;
  onChatOpen?: () => void;
  // New props for actionable recommendations
  todaysCheckIn?: DailyCheckIn | null;
  analysis?: CheckInAnalysis | null;
  baseline?: UserBaseline | null;
  meals?: { calories: number; protein: number; carbs: number; fats: number }[];
  waterIntakeMl?: number;
}

const getScoreColor = (score: number, inverted = false) => {
  const adjusted = inverted ? 6 - score : score;
  if (adjusted >= 4) return "text-green-500";
  if (adjusted >= 3) return "text-amber-500";
  return "text-red-500";
};

const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
  if (trend === "improving") return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (trend === "declining") return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

export const AICoachCard = ({ 
  greeting,
  insights,
  tip,
  onChatOpen,
  todaysCheckIn,
  analysis,
  baseline,
  meals = [],
  waterIntakeMl = 0
}: AICoachCardProps) => {
  const { t } = useLanguage();
  const [showRecommendations, setShowRecommendations] = useState(true);
  
  const displayGreeting = greeting || t('good_morning');

  // Calculate totals
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  
  const calorieGoal = baseline?.target_calories || 2000;
  const proteinGoal = baseline?.protein_grams || 120;
  const waterGoal = (baseline?.water_liters || 2.5) * 1000;
  const targetSleepHours = baseline?.sleep_hours ? parseFloat(baseline.sleep_hours) : 8;

  // Generate actionable recommendations based on check-in data
  const generateActionableRecommendations = (): InsightCard[] => {
    const recommendations: InsightCard[] = [];
    const hour = new Date().getHours();

    if (!todaysCheckIn) return recommendations;

    const sleepQuality = todaysCheckIn.sleep_quality || 3;
    const sleepHours = todaysCheckIn.sleep_hours || 0;
    const energyLevel = todaysCheckIn.energy_level || 3;
    const stressLevel = todaysCheckIn.stress_level || 3;
    const mood = todaysCheckIn.mood || 3;

    // === SLEEP-BASED ACTIONS ===
    if (sleepHours > 0 && sleepHours < targetSleepHours - 1) {
      const deficit = targetSleepHours - sleepHours;
      recommendations.push({
        type: "warning",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: `Sleep Deficit: ${deficit.toFixed(1)}h`,
        description: `Only ${sleepHours}h sleep increases hunger hormones by 45%.`,
        action: `Go to bed 1h earlier tonight. Add magnesium-rich foods (dark chocolate, almonds) to dinner.`,
        priority: 1,
      });
    } else if (sleepQuality <= 2) {
      recommendations.push({
        type: "warning",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: "Poor Sleep = Cravings Risk",
        description: "Low sleep quality spikes cortisol, triggering comfort food cravings.",
        action: "Limit caffeine to 1 cup before noon. Try 400mg magnesium glycinate tonight.",
        priority: 1,
      });
    } else if (sleepQuality >= 4 && sleepHours >= targetSleepHours) {
      recommendations.push({
        type: "positive",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: "Sleep Recovery: Optimal",
        description: `${sleepHours}h quality sleep — your metabolism and recovery are primed.`,
        priority: 6,
      });
    }

    // === ENERGY-BASED ACTIONS ===
    if (energyLevel <= 2) {
      const proteinNeeded = Math.max(0, Math.round(proteinGoal * 0.35) - totalProtein);
      const waterNeeded = Math.round((waterGoal - waterIntakeMl) / 1000 * 10) / 10;
      recommendations.push({
        type: "action",
        icon: <Battery className="w-5 h-5 text-green-500" />,
        title: "Low Energy Protocol",
        description: sleepQuality <= 2 
          ? "Low energy + poor sleep = your body needs strategic fuel."
          : "Low energy signals need for immediate nutrition action.",
        action: proteinNeeded > 0 
          ? `NOW: ${proteinNeeded}g protein + ${waterNeeded}L water before 2pm. Try eggs, Greek yogurt, or chicken.`
          : `Priority: Complex carbs (oats, sweet potato) + ${waterNeeded}L water in next hour.`,
        priority: 1,
      });
    } else if (energyLevel >= 4) {
      recommendations.push({
        type: "positive",
        icon: <Battery className="w-5 h-5 text-green-500" />,
        title: "High Energy = Opportunity",
        description: "Your energy is primed. Perfect day to dial in nutrition precision.",
        priority: 6,
      });
    }

    // === STRESS-BASED ACTIONS ===
    if (stressLevel >= 4) {
      recommendations.push({
        type: "action",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "High Stress Alert",
        description: "Elevated cortisol = increased appetite + impaired digestion.",
        action: "Today: Walk 10min after lunch. Add omega-3 (salmon/walnuts). Max 200mg caffeine. Skip sugar.",
        priority: 2,
      });
    } else if (stressLevel <= 2) {
      recommendations.push({
        type: "positive",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "Low Stress = Better Absorption",
        description: "Relaxed state optimizes nutrient absorption and blood sugar.",
        priority: 6,
      });
    }

    // === MOOD + ENERGY COMBO ===
    if (mood <= 2 && energyLevel <= 2) {
      recommendations.push({
        type: "action",
        icon: <Smile className="w-5 h-5 text-amber-500" />,
        title: "Mood-Energy Recovery",
        description: "Both low = blood sugar likely unstable.",
        action: `Immediate: ${Math.round(proteinGoal * 0.1)}g protein + complex carbs (Greek yogurt + berries, or eggs + toast).`,
        priority: 1,
      });
    }

    // === NUTRITION TIMING ACTIONS ===
    const calPercent = (totalCalories / calorieGoal) * 100;
    const proteinPercent = (totalProtein / proteinGoal) * 100;
    const waterPercent = (waterIntakeMl / waterGoal) * 100;

    if (hour >= 14 && calPercent < 40 && energyLevel <= 3) {
      recommendations.push({
        type: "action",
        icon: <Utensils className="w-5 h-5 text-orange-500" />,
        title: `Under-Fueled: ${Math.round(calPercent)}%`,
        description: `Only ${Math.round(calPercent)}% calories by afternoon + energy ${energyLevel}/5.`,
        action: `Next meal NOW: ${Math.round(calorieGoal * 0.3)} kcal with ${Math.round(proteinGoal * 0.25)}g protein minimum.`,
        priority: 2,
      });
    }

    if (hour >= 12 && proteinPercent < 30) {
      recommendations.push({
        type: "action",
        icon: <Activity className="w-5 h-5 text-red-500" />,
        title: `Protein: Only ${Math.round(proteinPercent)}%`,
        description: "Behind schedule — protein is key for satiety and muscle.",
        action: `Add ${Math.round(proteinGoal * 0.3)}g NOW: chicken breast (30g), 3 eggs (18g), Greek yogurt (15g), or tofu (20g).`,
        priority: 2,
      });
    }

    if (hour >= 12 && waterPercent < 40) {
      recommendations.push({
        type: "action",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: `Dehydrated: ${Math.round(waterPercent)}%`,
        description: "Dehydration feels like hunger and drops energy 20-30%.",
        action: `Drink ${Math.round((waterGoal - waterIntakeMl) / 2 / 1000 * 10) / 10}L in next 2 hours. Set phone reminder.`,
        priority: 3,
      });
    }

    // === TREND-BASED ACTIONS ===
    if (analysis) {
      if (analysis.trends.energy === "declining" && analysis.averageEnergy < 3) {
        recommendations.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-red-500" />,
          title: "7-Day Energy Declining",
          description: `Avg ${analysis.averageEnergy}/5 and falling. Pattern suggests under-fueling.`,
          action: `This week: Hit ${proteinGoal}g protein daily, ${targetSleepHours}h sleep, ${baseline?.water_liters || 2.5}L water. Track all 3.`,
          priority: 1,
        });
      }

      if (analysis.trends.sleep === "declining") {
        recommendations.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-red-500" />,
          title: "Sleep Quality Dropping",
          description: `Avg ${analysis.averageSleep}/5. Poor sleep = 300-500 extra calories from cravings.`,
          action: "This week: No caffeine after 2pm, screens off 1h before bed, try chamomile tea.",
          priority: 1,
        });
      }

      if (analysis.trends.mood === "improving") {
        recommendations.push({
          type: "positive",
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          title: "Mood Improving!",
          description: `Trending up (avg ${analysis.averageMood}/5). Keep doing what's working.`,
          priority: 5,
        });
      }
    }

    return recommendations.sort((a, b) => a.priority - b.priority).slice(0, 4);
  };

  const actionableRecommendations = todaysCheckIn ? generateActionableRecommendations() : [];
  const hasRecommendations = actionableRecommendations.length > 0;

  const getInsightStyle = (type: InsightCard["type"]) => {
    switch (type) {
      case "positive": return "bg-green-500/10 border-green-500/20";
      case "warning": return "bg-amber-500/10 border-amber-500/20";
      case "action": return "bg-blue-500/10 border-blue-500/20";
      default: return "bg-muted/50 border-border";
    }
  };

  const getTypeIcon = (type: InsightCard["type"]) => {
    switch (type) {
      case "positive": return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case "warning": return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case "action": return <Lightbulb className="w-3.5 h-3.5 text-blue-500" />;
      default: return <Zap className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };
  
  return (
    <div className="relative overflow-hidden bg-card rounded-2xl shadow-medium animate-slide-up">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center shadow-soft">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Coach Mac</h3>
              <p className="text-sm text-muted-foreground">Your nutrition coach</p>
            </div>
          </div>
          {onChatOpen && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onChatOpen}
              className="gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </Button>
          )}
        </div>

        {/* Greeting */}
        <p className="text-foreground mb-4">{displayGreeting}</p>

        {/* Quick Status Bar - Only show if checked in */}
        {todaysCheckIn && (
          <div className="mb-4 p-3 bg-muted/30 rounded-xl flex justify-around">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Smile className={`w-4 h-4 ${getScoreColor(todaysCheckIn.mood || 3)}`} />
                <span className={`text-sm font-bold ${getScoreColor(todaysCheckIn.mood || 3)}`}>
                  {todaysCheckIn.mood}/5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Mood</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Battery className={`w-4 h-4 ${getScoreColor(todaysCheckIn.energy_level || 3)}`} />
                <span className={`text-sm font-bold ${getScoreColor(todaysCheckIn.energy_level || 3)}`}>
                  {todaysCheckIn.energy_level}/5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Energy</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Moon className={`w-4 h-4 ${getScoreColor(todaysCheckIn.sleep_quality || 3)}`} />
                <span className={`text-sm font-bold ${getScoreColor(todaysCheckIn.sleep_quality || 3)}`}>
                  {todaysCheckIn.sleep_quality}/5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Sleep</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Brain className={`w-4 h-4 ${getScoreColor(todaysCheckIn.stress_level || 3, true)}`} />
                <span className={`text-sm font-bold ${getScoreColor(todaysCheckIn.stress_level || 3, true)}`}>
                  {todaysCheckIn.stress_level}/5
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Stress</p>
            </div>
          </div>
        )}

        {/* General Insights - Show when no check-in or as secondary info */}
        {!hasRecommendations && (
          <div className="space-y-3 mb-4">
            {insights.map((insight, index) => (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 bg-accent/50 rounded-xl"
              >
                {index === 0 ? (
                  <TrendingUp className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                ) : (
                  <Zap className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-foreground">{insight}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actionable Recommendations Section */}
        {hasRecommendations && (
          <div className="mb-4">
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="w-full flex items-center justify-between py-2 text-left"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-secondary" />
                <span className="text-sm font-semibold text-foreground">
                  Today's Action Plan
                </span>
                <span className="text-xs text-muted-foreground">
                  ({actionableRecommendations.length} items)
                </span>
              </div>
              {showRecommendations ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {showRecommendations && (
              <div className="space-y-3 mt-2">
                {actionableRecommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-xl border ${getInsightStyle(rec.type)} animate-slide-up`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {rec.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(rec.type)}
                          <h4 className="font-semibold text-foreground text-sm">{rec.title}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {rec.description}
                        </p>
                        {rec.action && (
                          <div className="flex items-start gap-2 p-2 bg-background/60 rounded-lg">
                            <Flame className="w-3.5 h-3.5 text-secondary flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-foreground">
                              {rec.action}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* 7-Day Trends Mini Summary */}
                {analysis && (
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">7-Day Trends</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Mood</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{analysis.averageMood}</span>
                          {getTrendIcon(analysis.trends.mood)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Energy</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{analysis.averageEnergy}</span>
                          {getTrendIcon(analysis.trends.energy)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Sleep</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{analysis.averageSleep}</span>
                          {getTrendIcon(analysis.trends.sleep)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Stress</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">{analysis.averageStress}</span>
                          {getTrendIcon(analysis.trends.stress)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Daily Tip */}
        {tip && (
          <div className="p-4 bg-secondary/10 rounded-xl border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-secondary">{t('tip_of_the_day')}</span>
            </div>
            <p className="text-sm text-foreground">{tip}</p>
          </div>
        )}
      </div>
    </div>
  );
};
