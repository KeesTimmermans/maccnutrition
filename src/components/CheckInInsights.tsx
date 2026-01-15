import { useState } from "react";
import { 
  Brain, 
  Battery, 
  Moon, 
  Smile, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Flame,
  Droplets,
  Utensils,
  Activity,
  ChevronDown,
  ChevronUp,
  Sparkles
} from "lucide-react";
import { CheckInAnalysis, DailyCheckIn } from "@/lib/checkinService";
import { UserBaseline } from "@/lib/userService";
import { useLanguage } from "@/lib/i18n";

interface CheckInInsightsProps {
  todaysCheckIn: DailyCheckIn | null;
  analysis: CheckInAnalysis | null;
  baseline: UserBaseline | null;
  meals: { calories: number; protein: number; carbs: number; fats: number }[];
  waterIntakeMl?: number;
}

interface InsightCard {
  type: "positive" | "warning" | "info" | "action";
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: string;
  priority: number;
}

const getTrendIcon = (trend: "improving" | "declining" | "stable", size = "w-4 h-4") => {
  if (trend === "improving") return <TrendingUp className={`${size} text-green-500`} />;
  if (trend === "declining") return <TrendingDown className={`${size} text-red-500`} />;
  return <Minus className={`${size} text-muted-foreground`} />;
};

const getScoreColor = (score: number, inverted = false) => {
  const adjusted = inverted ? 6 - score : score;
  if (adjusted >= 4) return "text-green-500";
  if (adjusted >= 3) return "text-amber-500";
  return "text-red-500";
};

const getScoreEmoji = (score: number) => {
  if (score >= 5) return "😊";
  if (score >= 4) return "🙂";
  if (score >= 3) return "😐";
  if (score >= 2) return "😕";
  return "😫";
};

export const CheckInInsights = ({ 
  todaysCheckIn, 
  analysis, 
  baseline,
  meals,
  waterIntakeMl = 0
}: CheckInInsightsProps) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  if (!todaysCheckIn && !analysis) {
    return null;
  }

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  
  const calorieGoal = baseline?.target_calories || 2000;
  const proteinGoal = baseline?.protein_grams || 120;
  const waterGoal = (baseline?.water_liters || 2.5) * 1000;
  const targetSleepHours = baseline?.sleep_hours ? parseFloat(baseline.sleep_hours) : 8;

  // Generate personalized insights
  const generateInsights = (): InsightCard[] => {
    const insights: InsightCard[] = [];
    const hour = new Date().getHours();

    if (!todaysCheckIn) return insights;

    // === SLEEP INSIGHTS ===
    const sleepQuality = todaysCheckIn.sleep_quality || 3;
    const sleepHours = todaysCheckIn.sleep_hours || 0;
    
    if (sleepHours > 0 && sleepHours < targetSleepHours - 1) {
      const deficit = targetSleepHours - sleepHours;
      insights.push({
        type: "warning",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: `Sleep Deficit: ${deficit.toFixed(1)}h`,
        description: `You slept ${sleepHours}h vs your ${targetSleepHours}h target. Sleep debt impacts hunger hormones and can increase cravings by 45%.`,
        action: `Tonight: Aim for bed by ${getTargetBedtime(targetSleepHours)} to recover.`,
        priority: 1,
      });
    } else if (sleepQuality <= 2) {
      insights.push({
        type: "warning",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: "Poor Sleep Quality",
        description: "Low sleep quality affects cortisol levels, potentially increasing appetite and making it harder to stick to nutrition goals.",
        action: "Consider 400mg magnesium glycinate before bed and avoiding screens 1h before sleep.",
        priority: 1,
      });
    } else if (sleepQuality >= 4 && sleepHours >= targetSleepHours) {
      insights.push({
        type: "positive",
        icon: <Moon className="w-5 h-5 text-blue-500" />,
        title: "Great Sleep Recovery!",
        description: `${sleepHours}h of quality sleep optimizes your metabolism and recovery. Your body is primed for a productive day.`,
        priority: 5,
      });
    }

    // === ENERGY INSIGHTS ===
    const energyLevel = todaysCheckIn.energy_level || 3;
    
    if (energyLevel <= 2) {
      const proteinNeeded = Math.max(0, Math.round(proteinGoal * 0.35) - totalProtein);
      insights.push({
        type: "action",
        icon: <Battery className="w-5 h-5 text-green-500" />,
        title: "Low Energy Alert",
        description: sleepQuality <= 2 
          ? "Low energy correlates with your poor sleep. Your body needs extra support today."
          : "Low energy could indicate insufficient fuel or dehydration.",
        action: proteinNeeded > 0 
          ? `Priority: Get ${proteinNeeded}g more protein and ${Math.round((waterGoal - waterIntakeMl) / 1000 * 10) / 10}L water by 2pm.`
          : `Focus on complex carbs and stay hydrated with ${Math.round((waterGoal - waterIntakeMl) / 1000 * 10) / 10}L more water.`,
        priority: 2,
      });
    } else if (energyLevel >= 4) {
      insights.push({
        type: "positive",
        icon: <Battery className="w-5 h-5 text-green-500" />,
        title: "High Energy Day!",
        description: "Great energy levels set you up for success. This is an ideal day for focusing on your nutrition goals.",
        priority: 6,
      });
    }

    // === STRESS INSIGHTS ===
    const stressLevel = todaysCheckIn.stress_level || 3;
    
    if (stressLevel >= 4) {
      insights.push({
        type: "warning",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "Elevated Stress Detected",
        description: "High stress increases cortisol, which can trigger cravings for high-calorie comfort foods and impair digestion.",
        action: "Consider: 10-min walk after meals, limit caffeine to 200mg, add omega-3 rich foods (salmon, walnuts).",
        priority: 2,
      });
    } else if (stressLevel <= 2) {
      insights.push({
        type: "positive",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "Low Stress = Better Digestion",
        description: "Your relaxed state optimizes nutrient absorption and helps maintain steady blood sugar levels.",
        priority: 6,
      });
    }

    // === MOOD + NUTRITION CORRELATION ===
    const mood = todaysCheckIn.mood || 3;
    
    if (mood <= 2 && energyLevel <= 2) {
      insights.push({
        type: "info",
        icon: <Smile className="w-5 h-5 text-amber-500" />,
        title: "Mood-Energy Connection",
        description: "Both mood and energy are low. This combination often responds well to blood sugar stabilization.",
        action: `Have a balanced snack: ${Math.round(proteinGoal * 0.1)}g protein + complex carbs (e.g., Greek yogurt with berries).`,
        priority: 2,
      });
    }

    // === TREND-BASED INSIGHTS ===
    if (analysis) {
      if (analysis.trends.energy === "declining" && analysis.averageEnergy < 3) {
        insights.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-red-500" />,
          title: "Energy Trend: Declining",
          description: `Your 7-day energy average is ${analysis.averageEnergy}/5 and trending down. This pattern often indicates under-eating or poor nutrient timing.`,
          action: `Check: Are you hitting ${proteinGoal}g protein? Getting ${targetSleepHours}h sleep? Drinking ${baseline?.water_liters || 2.5}L water?`,
          priority: 1,
        });
      }

      if (analysis.trends.sleep === "declining") {
        insights.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-red-500" />,
          title: "Sleep Quality Declining",
          description: `Sleep has been trending down (avg: ${analysis.averageSleep}/5). Poor sleep can increase calorie intake by 300-500 kcal/day through hunger hormones.`,
          action: "This week: No caffeine after 2pm, reduce blue light exposure, try chamomile tea before bed.",
          priority: 1,
        });
      }

      if (analysis.trends.mood === "improving") {
        insights.push({
          type: "positive",
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          title: "Mood is Improving!",
          description: `Your mood trend is positive (avg: ${analysis.averageMood}/5). Keep up whatever you're doing — consistency builds results.`,
          priority: 5,
        });
      }

      if (analysis.trends.stress === "improving") {
        insights.push({
          type: "positive",
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          title: "Stress Management Working",
          description: `Stress levels are dropping (avg: ${analysis.averageStress}/5). Lower stress = better food choices and digestion.`,
          priority: 5,
        });
      }
    }

    // === TIME-BASED NUTRITIONAL ADVICE ===
    const calPercent = (totalCalories / calorieGoal) * 100;
    const proteinPercent = (totalProtein / proteinGoal) * 100;

    if (hour >= 14 && calPercent < 40 && energyLevel <= 3) {
      insights.push({
        type: "action",
        icon: <Utensils className="w-5 h-5 text-orange-500" />,
        title: "Under-Fueled for Afternoon",
        description: `Only ${Math.round(calPercent)}% of calories by afternoon. Combined with your energy level (${energyLevel}/5), you need fuel.`,
        action: `Next meal: Aim for ${Math.round(calorieGoal * 0.3)} kcal with ${Math.round(proteinGoal * 0.25)}g protein to recover.`,
        priority: 2,
      });
    }

    if (hour >= 12 && proteinPercent < 30) {
      insights.push({
        type: "action",
        icon: <Activity className="w-5 h-5 text-red-500" />,
        title: "Protein Behind Schedule",
        description: `Only ${Math.round(proteinPercent)}% of protein goal by midday. Protein is crucial for satiety and maintaining energy.`,
        action: `Add ${Math.round(proteinGoal * 0.3)}g protein to your next meal (chicken breast, eggs, Greek yogurt, or legumes).`,
        priority: 2,
      });
    }

    // === HYDRATION CHECK ===
    const waterPercent = (waterIntakeMl / waterGoal) * 100;
    if (hour >= 12 && waterPercent < 40) {
      insights.push({
        type: "action",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: "Hydration Check",
        description: `Only ${Math.round(waterPercent)}% of water goal. Dehydration can feel like hunger and reduce energy by 20-30%.`,
        action: `Drink ${Math.round((waterGoal - waterIntakeMl) / 2 / 1000 * 10) / 10}L in the next 2 hours to catch up.`,
        priority: 3,
      });
    }

    // Sort by priority (lower number = higher priority)
    return insights.sort((a, b) => a.priority - b.priority).slice(0, 4);
  };

  const getTargetBedtime = (targetHours: number) => {
    const wakeTime = 7; // Assume 7am wake time
    const bedHour = 24 - targetHours + wakeTime - 1; // -1 for falling asleep time
    if (bedHour >= 12) {
      return `${bedHour > 12 ? bedHour - 12 : bedHour}:00 PM`;
    }
    return `${bedHour}:00 AM`;
  };

  const insights = generateInsights();

  if (insights.length === 0) {
    return null;
  }

  const getInsightStyle = (type: InsightCard["type"]) => {
    switch (type) {
      case "positive":
        return "bg-green-500/10 border-green-500/20";
      case "warning":
        return "bg-amber-500/10 border-amber-500/20";
      case "action":
        return "bg-blue-500/10 border-blue-500/20";
      default:
        return "bg-muted/50 border-border";
    }
  };

  const getInsightIcon = (type: InsightCard["type"]) => {
    switch (type) {
      case "positive":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "action":
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
      {/* Header */}
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">Today's Personalized Insights</h3>
            <p className="text-xs text-muted-foreground">
              Based on your check-in • {insights.length} insight{insights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {/* Quick Stats Bar */}
      {todaysCheckIn && (
        <div className="px-4 py-3 bg-muted/30 border-y border-border/50 flex justify-around">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg">{getScoreEmoji(todaysCheckIn.mood || 3)}</span>
              <span className={`text-sm font-semibold ${getScoreColor(todaysCheckIn.mood || 3)}`}>
                {todaysCheckIn.mood}/5
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Mood</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Battery className={`w-4 h-4 ${getScoreColor(todaysCheckIn.energy_level || 3)}`} />
              <span className={`text-sm font-semibold ${getScoreColor(todaysCheckIn.energy_level || 3)}`}>
                {todaysCheckIn.energy_level}/5
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Energy</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Moon className={`w-4 h-4 ${getScoreColor(todaysCheckIn.sleep_quality || 3)}`} />
              <span className={`text-sm font-semibold ${getScoreColor(todaysCheckIn.sleep_quality || 3)}`}>
                {todaysCheckIn.sleep_quality}/5
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Sleep</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Brain className={`w-4 h-4 ${getScoreColor(todaysCheckIn.stress_level || 3, true)}`} />
              <span className={`text-sm font-semibold ${getScoreColor(todaysCheckIn.stress_level || 3, true)}`}>
                {todaysCheckIn.stress_level}/5
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Stress</p>
          </div>
        </div>
      )}

      {/* Insights List */}
      {expanded && (
        <div className="p-4 space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className={`p-4 rounded-xl border ${getInsightStyle(insight.type)} animate-slide-up`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getInsightIcon(insight.type)}
                    <h4 className="font-semibold text-foreground text-sm">{insight.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <div className="flex items-start gap-2 mt-2 p-2 bg-background/60 rounded-lg">
                      <Flame className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-foreground">
                        {insight.action}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 7-Day Trends Summary */}
          {analysis && (
            <div className="mt-4 p-4 bg-muted/30 rounded-xl">
              <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                7-Day Trends
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Mood</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{analysis.averageMood}/5</span>
                    {getTrendIcon(analysis.trends.mood)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Energy</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{analysis.averageEnergy}/5</span>
                    {getTrendIcon(analysis.trends.energy)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Sleep</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{analysis.averageSleep}/5</span>
                    {getTrendIcon(analysis.trends.sleep)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Stress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{analysis.averageStress}/5</span>
                    {getTrendIcon(analysis.trends.stress)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
