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

  // Generate actionable recommendations based on check-in data AND onboarding profile
  const generateActionableRecommendations = (): InsightCard[] => {
    const recommendations: InsightCard[] = [];
    const hour = new Date().getHours();

    if (!todaysCheckIn) return recommendations;

    const sleepQuality = todaysCheckIn.sleep_quality || 3;
    const sleepHours = todaysCheckIn.sleep_hours || 0;
    const energyLevel = todaysCheckIn.energy_level || 3;
    const stressLevel = todaysCheckIn.stress_level || 3;
    const mood = todaysCheckIn.mood || 3;

    // Get behavioral profile from baseline
    const eatingSpeed = baseline?.eating_speed;
    const hungerPatterns = baseline?.hunger_patterns;
    const emotionalEating = baseline?.emotional_eating;
    const biggestChallenge = baseline?.biggest_challenge;
    const cravingsTriggers = baseline?.cravings_triggers || [];
    const weekendHabits = baseline?.weekend_habits;
    const energyPatterns = baseline?.energy_patterns;
    const hydrationHabits = baseline?.hydration_habits;
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

    // === PERSONALIZED SLEEP-BASED ACTIONS ===
    if (sleepHours > 0 && sleepHours < targetSleepHours - 1) {
      const deficit = targetSleepHours - sleepHours;
      const cravingsWarning = emotionalEating === "often" 
        ? " Watch for emotional cravings today - have protein snacks ready."
        : "";
      recommendations.push({
        type: "warning",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: `Sleep Deficit: ${deficit.toFixed(1)}h`,
        description: `Only ${sleepHours}h sleep increases hunger hormones by 45%.${cravingsWarning}`,
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

    // === PERSONALIZED ENERGY-BASED ACTIONS (using energy patterns) ===
    if (energyLevel <= 2) {
      const proteinNeeded = Math.max(0, Math.round(proteinGoal * 0.35) - totalProtein);
      const waterNeeded = Math.round((waterGoal - waterIntakeMl) / 1000 * 10) / 10;
      const energyTip = energyPatterns === "morning" && hour > 10
        ? "You're a morning person - energy dips after 10am are normal. Fuel up now."
        : energyPatterns === "afternoon" 
        ? "Your peak is coming. Fuel now to maximize your afternoon."
        : "";
      recommendations.push({
        type: "action",
        icon: <Battery className="w-5 h-5 text-green-500" />,
        title: "Low Energy Protocol",
        description: energyTip || (sleepQuality <= 2 
          ? "Low energy + poor sleep = your body needs strategic fuel."
          : "Low energy signals need for immediate nutrition action."),
        action: proteinNeeded > 0 
          ? `NOW: ${proteinNeeded}g protein + ${waterNeeded}L water. Try eggs, Greek yogurt, or chicken.`
          : `Priority: Complex carbs (oats, sweet potato) + ${waterNeeded}L water in next hour.`,
        priority: 1,
      });
    }

    // === PERSONALIZED STRESS-BASED ACTIONS (using cravings triggers) ===
    if (stressLevel >= 4) {
      const stressTriggersCravings = cravingsTriggers.includes("stress");
      recommendations.push({
        type: "action",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "High Stress Alert",
        description: stressTriggersCravings
          ? "You mentioned stress triggers cravings for you. Have healthy options ready."
          : "Elevated cortisol = increased appetite + impaired digestion.",
        action: stressTriggersCravings
          ? "Prep protein snacks NOW (nuts, cheese, boiled eggs). Walk 10min after lunch. Skip sugar today."
          : "Today: Walk 10min after lunch. Add omega-3 (salmon/walnuts). Max 200mg caffeine.",
        priority: 2,
      });
    }

    // === EATING SPEED REMINDER ===
    if (eatingSpeed === "fast" && hour >= 11 && hour <= 14) {
      recommendations.push({
        type: "info",
        icon: <Utensils className="w-5 h-5 text-orange-500" />,
        title: "Slow Down Today",
        description: "Fast eaters often eat 10-15% more before feeling full.",
        action: "Put fork down between bites. Chew 20x. Set a 20-min meal timer.",
        priority: 4,
      });
    }

    // === HUNGER PATTERN PERSONALIZATION ===
    if (hungerPatterns === "evening" && hour >= 14 && totalCalories < calorieGoal * 0.5) {
      recommendations.push({
        type: "action",
        icon: <Utensils className="w-5 h-5 text-orange-500" />,
        title: "Evening Eater Alert",
        description: "You get hungrier at night. Front-load calories now to prevent overeating later.",
        action: `Eat ${Math.round(calorieGoal * 0.35)} kcal with ${Math.round(proteinGoal * 0.3)}g protein in the next 2 hours.`,
        priority: 2,
      });
    }

    // === WEEKEND HABITS WARNING ===
    if (isWeekend && weekendHabits === "different") {
      recommendations.push({
        type: "warning",
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        title: "Weekend Mindfulness",
        description: "You mentioned weekends go off-track. Stay aware today.",
        action: "Log every meal. Plan one indulgence consciously. Keep protein high.",
        priority: 3,
      });
    }

    // === CHALLENGE-SPECIFIC COACHING ===
    if (biggestChallenge === "consistency" && hour >= 18) {
      recommendations.push({
        type: "info",
        icon: <Flame className="w-5 h-5 text-secondary" />,
        title: "Consistency Win",
        description: "Evening is when habits break. You've got this far today!",
        action: "Finish strong. One more protein-rich meal, then you're done.",
        priority: 5,
      });
    } else if (biggestChallenge === "portion_control" && meals.length > 0) {
      recommendations.push({
        type: "info",
        icon: <Utensils className="w-5 h-5 text-orange-500" />,
        title: "Portion Tip",
        description: "You mentioned portions are challenging. Use smaller plates today.",
        action: "Serve 80% of what you'd normally take. Wait 20min before seconds.",
        priority: 4,
      });
    }

    // === HYDRATION HABITS ===
    if (hydrationHabits === "poor" && waterIntakeMl < waterGoal * 0.3 && hour >= 12) {
      recommendations.push({
        type: "action",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: "Hydration Priority",
        description: "You mentioned forgetting to drink. Dehydration = false hunger + low energy.",
        action: `Set hourly phone reminders. Drink ${Math.round((waterGoal - waterIntakeMl) / 3 / 1000 * 10) / 10}L before 3pm.`,
        priority: 2,
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
          action: `This week: Hit ${proteinGoal}g protein daily, ${targetSleepHours}h sleep, ${baseline?.water_liters || 2.5}L water.`,
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
