import type { ActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";
import {
  Bot, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Zap, 
  MessageCircle,
  Battery,
  Moon,
  Brain,
  Smile,
  Droplets,
  Utensils,
  Activity,
  Flame,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Target,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { CheckInAnalysis, DailyCheckIn } from "@/lib/checkinService";
import { UserBaseline } from "@/lib/userService";
import { MealPatternAnalysis } from "@/lib/coachingAnalytics";
import { CoachingFocusPoint } from "@/lib/progressUpdateService";

interface InsightCard {
  type: "positive" | "warning" | "action" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
  details?: string;
  action?: string;
  priority: number;
}

interface AICoachCardProps {
  greeting?: string;
  insights: string[];
  tip?: string;
  onChatOpen?: () => void;
  // Props for actionable recommendations
  todaysCheckIn?: DailyCheckIn | null;
  analysis?: CheckInAnalysis | null;
  baseline?: UserBaseline | null;
  /** Resolved active targets — single source of truth for all macro/hydration goals */
  activeTargets?: ActiveNutritionTargets | null;
  meals?: { calories: number; protein: number; carbs: number; fats: number }[];
  waterIntakeMl?: number;
  // Historical data props
  mealPatterns?: MealPatternAnalysis | null;
  accountAgeDays?: number;
  // Custom focus points from progress updates (monthly)
  customFocusPoints?: CoachingFocusPoint[] | null;
  // Daily focus points from check-in AI response
  dailyCheckInFocusPoints?: CoachingFocusPoint[] | null;
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
  activeTargets,
  meals = [],
  waterIntakeMl = 0,
  mealPatterns,
  accountAgeDays = 0,
  customFocusPoints,
  dailyCheckInFocusPoints
}: AICoachCardProps) => {
  const { t } = useLanguage();
  
  const displayGreeting = greeting || t('good_morning');

  // Calculate totals
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFats = meals.reduce((sum, m) => sum + m.fats, 0);
  
  // Use activeTargets (single source of truth) with baseline as fallback
  const calorieGoal = activeTargets?.calories ?? baseline?.target_calories ?? 2000;
  const proteinGoal = activeTargets?.protein ?? baseline?.protein_grams ?? 120;
  const carbsGoal = activeTargets?.carbs ?? baseline?.carbs_grams ?? 200;
  const fatsGoal = activeTargets?.fats ?? baseline?.fats_grams ?? 65;
  const waterGoalL = activeTargets?.waterLiters ?? baseline?.water_liters ?? 2.5;
  const waterGoal = waterGoalL * 1000;
  const targetSleepHours = baseline?.sleep_hours ? parseFloat(baseline.sleep_hours) : 8;
  
  const calPercent = Math.round((totalCalories / calorieGoal) * 100);
  const proteinPercent = Math.round((totalProtein / proteinGoal) * 100);
  const waterPercent = Math.round((waterIntakeMl / waterGoal) * 100);
  const firstName = baseline?.name?.split(' ')[0] || '';

  // Generate actionable recommendations based on check-in data, meal data, AND onboarding profile
  const generateActionableRecommendations = (): InsightCard[] => {
    const recommendations: InsightCard[] = [];
    const hour = new Date().getHours();
    const hasMeals = meals.length > 0;

    // Get behavioral profile from baseline (always available)
    const eatingSpeed = baseline?.eating_speed;
    const hungerPatterns = baseline?.hunger_patterns;
    const emotionalEating = baseline?.emotional_eating;
    const biggestChallenge = baseline?.biggest_challenge;
    const cravingsTriggers = baseline?.cravings_triggers || [];
    const weekendHabits = baseline?.weekend_habits;
    const energyPatterns = baseline?.energy_patterns;
    const hydrationHabits = baseline?.hydration_habits;
    const snackingHabits = baseline?.snacking_habits;
    const cookingSkill = baseline?.cooking_skill;
    const mealPrepTime = baseline?.meal_prep_time;
    const primaryGoal = baseline?.primary_goal;
    const focusPoints = baseline?.focus_points || [];
    const dietType = baseline?.diet_type;
    const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;

    // === DAILY TARGETS CARD (always show measurable goals first) ===
    const remainingCalories = calorieGoal - totalCalories;
    const remainingProtein = proteinGoal - totalProtein;
    const remainingWater = Math.round((waterGoal - waterIntakeMl) / 100) / 10;
    const mealsRemaining = hour < 10 ? 3 : hour < 14 ? 2 : hour < 19 ? 1 : 0;

    // Always lead with specific measurable targets
    if (!hasMeals && hour >= 6) {
      // Morning targets - specific numbers upfront
      if (hour < 12) {
        const breakfastProtein = Math.round(proteinGoal * 0.3);
        const breakfastCals = Math.round(calorieGoal * 0.3);
        recommendations.push({
          type: "action",
          icon: <Target className="w-5 h-5 text-primary" />,
          title: `Today: ${calorieGoal} kcal | ${proteinGoal}g protein | ${baseline?.water_liters || 2.5}L water`,
          description: `Breakfast target: ${breakfastProtein}g protein, ${breakfastCals} kcal. This front-loads your nutrition for stable energy and fewer cravings.`,
          action: `NOW: 3 eggs (18g) + toast = 350 kcal, 20g protein. Or: Greek yogurt 200g (20g protein) + granola = 400 kcal.`,
          priority: 1,
        });
      } else if (hour < 17) {
        // Afternoon targets
        recommendations.push({
          type: "warning",
          icon: <Target className="w-5 h-5 text-destructive" />,
          title: `Behind Schedule: 0/${calorieGoal} kcal | 0/${proteinGoal}g protein`,
          description: `It's ${hour > 12 ? 'afternoon' : 'midday'} with no meals logged. You need ${Math.round(remainingCalories / Math.max(mealsRemaining, 1))} kcal and ${Math.round(remainingProtein / Math.max(mealsRemaining, 1))}g protein per remaining meal.`,
          action: `Priority meal NOW: Chicken breast 150g (47g protein, 250 kcal) + rice 150g (200 kcal) + veggies = 500 kcal, 50g protein.`,
          priority: 1,
        });
      } else {
        // Evening targets
        recommendations.push({
          type: "warning",
          icon: <AlertCircle className="w-5 h-5 text-destructive" />,
          title: `Evening Alert: ${remainingCalories} kcal | ${remainingProtein}g protein remaining`,
          description: `Log your meals to track today's intake. Even estimates help identify patterns over time.`,
          action: `Protein-rich dinner: Salmon 200g (40g protein), beef steak 200g (50g protein), or tofu stir-fry 300g (24g protein).`,
          priority: 1,
        });
      }

      // Hydration with specific target
      recommendations.push({
        type: "action",
        icon: <Droplets className="w-5 h-5 text-blue-500" />,
        title: `Water: 0/${baseline?.water_liters || 2.5}L — Drink 500ml now`,
        description: `Target ${Math.round((baseline?.water_liters || 2.5) * 1000 / (18 - hour))}ml/hour to hit your goal by end of day.`,
        action: `Set hourly reminder: 250ml every hour. Dehydration causes false hunger and 15% drop in energy.`,
        priority: 2,
      });
    }

    // === WITH MEALS LOGGED - Show specific remaining targets ===
    if (hasMeals) {
      // Always show exact remaining targets
      if (proteinPercent < 100 && hour < 20) {
        const proteinPerMeal = Math.round(remainingProtein / Math.max(mealsRemaining, 1));
        recommendations.push({
          type: proteinPercent < 50 && hour >= 14 ? "warning" : "action",
          icon: <Flame className="w-5 h-5 text-secondary" />,
          title: `Protein: ${totalProtein}/${proteinGoal}g — Need ${remainingProtein}g more`,
          description: mealsRemaining > 0 
            ? `That's ${proteinPerMeal}g protein per remaining meal (${mealsRemaining} left).`
            : `Add a high-protein snack: cottage cheese 200g (22g), protein shake (25g), or Greek yogurt (17g).`,
          action: `Quick wins: Chicken 100g = 31g | Salmon 100g = 25g | Eggs 3 = 18g | Greek yogurt 200g = 20g | Tuna can = 25g`,
          priority: proteinPercent < 40 && hour >= 14 ? 1 : 2,
        });
      }

      // Calorie target with specific numbers
      if (calPercent < 85 && hour >= 14) {
        const calPerMeal = Math.round(remainingCalories / Math.max(mealsRemaining, 1));
        recommendations.push({
          type: calPercent < 50 ? "warning" : "info",
          icon: <Activity className="w-5 h-5 text-primary" />,
          title: `Calories: ${totalCalories}/${calorieGoal} kcal — ${remainingCalories} kcal to go`,
          description: calPercent < 40 
            ? `Under-eating slows metabolism and increases late-night cravings. Eat ${calPerMeal} kcal now.`
            : `You're on track. Aim for ~${calPerMeal} kcal in your next meal.`,
          action: `Balanced meal: Palm-size protein (200 kcal) + fist of carbs (150 kcal) + thumb of fat (100 kcal) = 450 kcal`,
          priority: calPercent < 40 ? 1 : 3,
        });
      } else if (calPercent > 110) {
        const excess = totalCalories - calorieGoal;
        recommendations.push({
          type: "info",
          icon: <Activity className="w-5 h-5 text-muted-foreground" />,
          title: `Calories: ${totalCalories}/${calorieGoal} kcal — +${excess} over target`,
          description: `One day won't derail progress. Focus on hitting ${proteinGoal}g protein and resume normal intake tomorrow.`,
          action: `If eating more: Choose protein-rich, low-calorie options. Skip added fats and sugary drinks.`,
          priority: 4,
        });
      }

      // Water with exact remaining target
      if (waterPercent < 80) {
        recommendations.push({
          type: waterPercent < 50 && hour >= 14 ? "warning" : "info",
          icon: <Droplets className="w-5 h-5 text-blue-500" />,
          title: `Water: ${Math.round(waterIntakeMl/100)/10}/${baseline?.water_liters || 2.5}L — ${remainingWater}L to go`,
          description: `Drink ${Math.round(remainingWater / Math.max(20 - hour, 1) * 10) / 10}L per hour to hit your target.`,
          action: `NOW: Drink 500ml. Set phone timer for 250ml every hour until ${baseline?.water_liters || 2.5}L reached.`,
          priority: waterPercent < 40 && hour >= 12 ? 2 : 4,
        });
      }
    }

    // === GOAL-SPECIFIC MEASURABLE COACHING ===
    if (primaryGoal === "fat_loss" && hasMeals) {
      const deficitTarget = Math.round(calorieGoal * 0.9); // 10% buffer
      if (totalCalories > deficitTarget && calPercent < 110) {
        recommendations.push({
          type: "positive",
          icon: <CheckCircle2 className="w-5 h-5 text-primary" />,
          title: `Fat Loss Zone: ${totalCalories} kcal logged`,
          description: `You're in your target range (${Math.round(calorieGoal * 0.85)}-${calorieGoal} kcal). Protein at ${proteinPercent}%.`,
          priority: 5,
        });
      }
    }

    if (primaryGoal === "muscle_gain" && hasMeals && hour >= 14) {
      const carbsPercent = Math.round((totalCarbs / carbsGoal) * 100);
      if (carbsPercent < 50) {
        recommendations.push({
          type: "action",
          icon: <Flame className="w-5 h-5 text-secondary" />,
          title: `Carbs: ${totalCarbs}/${carbsGoal}g — Need ${carbsGoal - totalCarbs}g more`,
          description: `Carbs fuel muscle growth and training. You're behind on carbs for muscle gain.`,
          action: `Add: Rice 200g = 56g carbs | Oats 100g = 66g | Sweet potato 200g = 40g | Banana = 27g`,
          priority: 2,
        });
      }
    }

    // === FOCUS POINT COACHING (from onboarding) ===
    if (focusPoints.length > 0 && !hasMeals) {
      const topFocus = focusPoints[0];
      if (topFocus.includes("protein")) {
        recommendations.push({
          type: "info",
          icon: <Flame className="w-5 h-5 text-orange-500" />,
          title: "Focus: Protein Priority",
          description: `Your personalized focus is hitting ${proteinGoal}g protein daily. This is key for ${primaryGoal?.replace(/_/g, ' ') || 'your goals'}.`,
          action: `Include protein at every meal: eggs/Greek yogurt at breakfast, chicken/fish at lunch, lean meat/legumes at dinner. Track to verify you're hitting target.`,
          priority: 3,
        });
      } else if (topFocus.includes("hydration")) {
        recommendations.push({
          type: "info",
          icon: <Droplets className="w-5 h-5 text-blue-400" />,
          title: "Focus: Hydration Habits",
          description: `Water intake is a key focus for you. Target ${baseline?.water_liters || 2.5}L daily for optimal energy and metabolism.`,
          action: `Strategy: Drink 500ml upon waking, sip throughout the day, 250ml before each meal. Set hourly reminders if you forget.`,
          priority: 3,
        });
      }
    }

    // === DIET TYPE SPECIFIC GUIDANCE ===
    if (dietType && !hasMeals && hour < 14) {
      if (dietType === "vegetarian" || dietType === "vegan") {
        recommendations.push({
          type: "info",
          icon: <Utensils className="w-5 h-5 text-green-500" />,
          title: `${dietType.charAt(0).toUpperCase() + dietType.slice(1)} Protein Tips`,
          description: `Hitting ${proteinGoal}g protein on a ${dietType} diet requires planning. Combine protein sources throughout the day.`,
          action: `High-protein options: Tofu (20g/150g), tempeh (19g/100g), lentils (9g/100g), Greek yogurt (10g/100g), quinoa (8g/cup). Aim for variety.`,
          priority: 3,
        });
      }
    }

    // === BEHAVIORAL PATTERN COACHING (always relevant) ===
    
    // Snacking habits awareness
    if (snackingHabits === "frequent" && hour >= 14 && hour < 18) {
      recommendations.push({
        type: "info",
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        title: "Afternoon Snack Awareness",
        description: `You mentioned frequent snacking. This is peak snack time—have healthy options ready.`,
        action: `Pre-plan snacks: Greek yogurt, nuts (1 handful), protein bar, or veggies with hummus. Avoid walking past vending machines.`,
        priority: hasMeals ? 4 : 2,
      });
    }

    // Emotional eating awareness (from cravings triggers)
    if (cravingsTriggers.includes("boredom") && hour >= 14 && hour < 20) {
      recommendations.push({
        type: "info",
        icon: <Brain className="w-5 h-5 text-purple-500" />,
        title: "Boredom Eating Check",
        description: `You identified boredom as a craving trigger. Before reaching for food, ask: Am I actually hungry?`,
        action: `Try the 10-minute rule: If you're not sure you're hungry, wait 10 minutes and drink water. If still hungry after, eat mindfully.`,
        priority: 4,
      });
    }

    // === REAL-TIME MEAL DATA RECOMMENDATIONS (always active) ===
    
    // Protein urgency check (use existing mealsRemaining from above)
    const proteinRemaining = proteinGoal - totalProtein;
    
    if (hour >= 14 && proteinPercent < 40) {
      recommendations.push({
        type: "action",
        icon: <Flame className="w-5 h-5 text-orange-500" />,
        title: `Protein Alert: ${proteinPercent}% of Daily Goal`,
        description: `You've only logged ${totalProtein}g of your ${proteinGoal}g protein target so far. With ${mealsRemaining} meal${mealsRemaining > 1 ? 's' : ''} remaining, you need approximately ${proteinRemaining}g more protein to hit your goal.`,
        details: `Protein is essential for muscle recovery, metabolism, and satiety. Being this far behind in the afternoon means you'll need to prioritize protein-rich foods for the rest of the day. Low protein intake can lead to increased hunger later and difficulty maintaining lean muscle mass.`,
        action: `Target ${Math.round(proteinRemaining / mealsRemaining)}g protein per remaining meal. Quick options: grilled chicken breast (31g per 100g), salmon fillet (25g per 100g), Greek yogurt (10g per 100g), or 3 eggs (18g total). Consider adding a protein shake if meals fall short.`,
        priority: 1,
      });
    } else if (proteinPercent >= 80 && proteinPercent < 100) {
      recommendations.push({
        type: "info",
        icon: <Flame className="w-5 h-5 text-green-500" />,
        title: `Protein on Track: ${proteinPercent}%`,
        description: `Great progress${firstName ? `, ${firstName}` : ''}! You've logged ${totalProtein}g of ${proteinGoal}g. Just ${proteinRemaining}g to go to hit your target.`,
        details: `You're in a strong position. Focus on including a quality protein source in your next meal to lock in this win. Consistent protein intake throughout the day optimizes muscle protein synthesis.`,
        action: `Finish strong with one more protein-rich meal or snack: cottage cheese (11g per 100g), tuna (26g per 100g), or a handful of almonds with cheese.`,
        priority: 5,
      });
    } else if (proteinPercent >= 100) {
      recommendations.push({
        type: "positive",
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        title: `Protein Goal Achieved!`,
        description: `Excellent work${firstName ? `, ${firstName}` : ''}! You've logged ${totalProtein}g protein today, exceeding your ${proteinGoal}g goal.`,
        details: `This supports your ${baseline?.primary_goal?.replace(/_/g, ' ') || 'nutrition goals'} by ensuring optimal muscle protein synthesis, improved satiety, and stable blood sugar levels. Consistent protein intake like this compounds into real results over weeks and months.`,
        priority: 6,
      });
    }

    // Calorie check
    if (hour >= 14 && calPercent < 30) {
      const caloriesNeeded = calorieGoal - totalCalories;
      recommendations.push({
        type: "warning",
        icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
        title: `Under-Fueling Warning: Only ${calPercent}% of Calories`,
        description: `You've only consumed ${totalCalories} kcal out of your ${calorieGoal} kcal target, and it's already afternoon. This under-eating pattern puts you at risk for energy crashes, increased cravings, and metabolic slowdown.`,
        details: `When you don't eat enough during the day, your body goes into energy-conservation mode. This can lead to intense hunger later, making it harder to make good food choices. It also affects your workout performance, recovery, and mental clarity.`,
        action: `Priority action: Eat a balanced meal NOW with approximately ${Math.round(caloriesNeeded / mealsRemaining)} kcal. Include a palm-sized protein (25-30g), a fist-sized portion of complex carbs (rice, potato, bread), and some healthy fats. Don't try to "save" calories for later—this backfires.`,
        priority: 1,
      });
    } else if (calPercent >= 70 && calPercent <= 100) {
      recommendations.push({
        type: "positive",
        icon: <Activity className="w-5 h-5 text-green-500" />,
        title: `Calories on Track: ${calPercent}%`,
        description: `You've consumed ${totalCalories} kcal of your ${calorieGoal} kcal target. You're pacing well through the day.`,
        details: `Consistent calorie distribution throughout the day optimizes energy levels, prevents overeating, and supports your ${baseline?.primary_goal?.replace(/_/g, ' ') || 'goals'}. Keep up this steady approach.`,
        priority: 6,
      });
    } else if (calPercent > 100 && calPercent <= 115) {
      const excess = totalCalories - calorieGoal;
      recommendations.push({
        type: "info",
        icon: <Activity className="w-5 h-5 text-blue-500" />,
        title: `Slightly Over Target: +${excess} kcal`,
        description: `You've exceeded your ${calorieGoal} kcal target by ${excess} calories. This is completely fine and won't derail your progress.`,
        details: `Single-day variations are normal and expected. Your body doesn't operate on a strict 24-hour cycle. What matters is your weekly average and overall consistency. Tomorrow, you might naturally eat a bit less.`,
        action: `For any remaining meals today: focus on protein-rich, high-volume foods like chicken with vegetables, fish with salad, or Greek yogurt with berries. Skip added fats and sugary drinks.`,
        priority: 4,
      });
    } else if (calPercent > 115) {
      const excess = totalCalories - calorieGoal;
      recommendations.push({
        type: "warning",
        icon: <Activity className="w-5 h-5 text-amber-500" />,
        title: `Over Target: +${excess} kcal`,
        description: `You've exceeded your daily target by ${excess} calories. Let's use this as a learning moment rather than a setback.`,
        details: `This doesn't ruin your progress. One day of overeating requires about 3,500 extra calories to gain even half a kilogram of fat. Focus on getting back to your normal routine tomorrow—no need to "make up for it" by under-eating.`,
        action: `Don't skip meals tomorrow. Resume your normal eating pattern. If there are triggers that led to today's intake (stress, social event, hunger from under-eating earlier), note them for future awareness.`,
        priority: 3,
      });
    }

    // Hydration real-time check
    const currentWaterL = Math.round(waterIntakeMl / 1000 * 10) / 10;
    const targetWaterL = baseline?.water_liters || 2.5;
    const waterNeeded = Math.round((waterGoal - waterIntakeMl) / 1000 * 10) / 10;
    
    if (hour >= 12 && waterPercent < 30) {
      recommendations.push({
        type: "action",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: `Hydration Alert: Only ${waterPercent}% of Goal`,
        description: `You've only logged ${currentWaterL}L of your ${targetWaterL}L daily target. By midday, you should be at least at 50%. Dehydration often masquerades as hunger and causes fatigue, headaches, and reduced focus.`,
        details: `Even mild dehydration (1-2% body weight loss) impairs cognitive function, mood, and physical performance. It also slows metabolism and can trigger false hunger signals, leading to unnecessary snacking. Your body can't distinguish thirst from hunger.`,
        action: `Immediate action: Drink ${Math.min(waterNeeded, 1)}L of water in the next hour. Keep a water bottle visible at your desk. Set hourly phone reminders if you tend to forget. Aim to finish ${Math.round(waterNeeded * 0.6 * 10) / 10}L by 3pm.`,
        priority: 2,
      });
    } else if (waterPercent >= 50 && waterPercent < 80 && hour >= 14) {
      recommendations.push({
        type: "info",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: `Hydration Progress: ${waterPercent}%`,
        description: `You've logged ${currentWaterL}L of ${targetWaterL}L. You're making progress but need to pick up the pace to hit your goal by end of day.`,
        details: `Consistent hydration throughout the day is more effective than trying to catch up later. Drinking too much water at once can actually impair absorption. Aim for steady sips.`,
        action: `Drink ${Math.round(waterNeeded / 3 * 10) / 10}L now, and set reminders to drink the same amount mid-afternoon and early evening.`,
        priority: 4,
      });
    } else if (waterPercent >= 90) {
      recommendations.push({
        type: "positive",
        icon: <Droplets className="w-5 h-5 text-blue-400" />,
        title: "Hydration Goal Achieved!",
        description: `Excellent${firstName ? `, ${firstName}` : ''}! You've logged ${currentWaterL}L of your ${targetWaterL}L target. Proper hydration optimizes metabolism, energy, and cognitive function.`,
        details: `Staying well-hydrated supports nutrient transport, temperature regulation, and waste elimination. It also helps you distinguish true hunger from thirst, making it easier to stick to your nutrition plan.`,
        priority: 6,
      });
    }

    // All goals near complete
    if (calPercent >= 85 && proteinPercent >= 85 && waterPercent >= 80) {
      recommendations.push({
        type: "positive",
        icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        title: `Almost Perfect Day${firstName ? `, ${firstName}` : ''}!`,
        description: `Calories ${calPercent}%, Protein ${proteinPercent}%, Water ${waterPercent}%. Finish strong!`,
        priority: 5,
      });
    }

    // === CHECK-IN BASED RECOMMENDATIONS ===
    if (todaysCheckIn) {
      const sleepQuality = todaysCheckIn.sleep_quality || 3;
      const sleepHours = todaysCheckIn.sleep_hours || 0;
      const energyLevel = todaysCheckIn.energy_level || 3;
      const stressLevel = todaysCheckIn.stress_level || 3;

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
    } // End of if (todaysCheckIn)

    // === TREND-BASED ACTIONS (works with or without check-in) ===
    if (analysis) {
      if (analysis.trends.energy === "declining" && analysis.averageEnergy < 3) {
        recommendations.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-destructive" />,
          title: "7-Day Energy Declining",
          description: `Avg ${analysis.averageEnergy}/5 and falling. Pattern suggests under-fueling.`,
          action: `This week: Hit ${proteinGoal}g protein daily, ${targetSleepHours}h sleep, ${baseline?.water_liters || 2.5}L water.`,
          priority: 1,
        });
      }

      if (analysis.trends.mood === "improving") {
        recommendations.push({
          type: "positive",
          icon: <TrendingUp className="w-5 h-5 text-primary" />,
          title: "Mood Improving!",
          description: `Trending up (avg ${analysis.averageMood}/5). Keep doing what's working.`,
          priority: 5,
        });
      }
    }

    // === HISTORICAL MEAL PATTERN INSIGHTS (from past 7 days) ===
    if (mealPatterns && mealPatterns.daysTracked >= 3) {
      const { weeklyProteinHitRate, weeklyCalorieHitRate, proteinTrend, weekendVsWeekday, averageProteinByMealNumber, averageMealsPerDay, proteinConsistency, calorieConsistency } = mealPatterns;

      // Protein consistency coaching
      if (weeklyProteinHitRate < 50) {
        recommendations.push({
          type: "warning",
          icon: <Target className="w-5 h-5 text-destructive" />,
          title: `Protein Goal Hit Rate: ${weeklyProteinHitRate}%`,
          description: `You've hit your ${proteinGoal}g protein goal only ${weeklyProteinHitRate}% of tracked days this week. This is your #1 area for improvement.`,
          details: `Consistent protein is essential for ${primaryGoal?.replace(/_/g, ' ') || 'your goals'}. Low hit rate often means breakfast lacks protein or portions are underestimated.`,
          action: `Start breakfast with ${Math.round(proteinGoal * 0.3)}g protein today. Track every meal to stay accountable. Consider a protein shake if meals fall short.`,
          priority: 1,
        });
      } else if (weeklyProteinHitRate >= 80) {
        recommendations.push({
          type: "positive",
          icon: <Target className="w-5 h-5 text-primary" />,
          title: `Protein Consistency: ${weeklyProteinHitRate}%!`,
          description: `You're hitting your protein goal ${weeklyProteinHitRate}% of days. This consistency is exactly what drives results.`,
          action: `Keep it up! You're building habits that compound into real progress.`,
          priority: 6,
        });
      }

      // Protein trend coaching
      if (proteinTrend === "declining") {
        recommendations.push({
          type: "warning",
          icon: <TrendingDown className="w-5 h-5 text-destructive" />,
          title: "Protein Intake Declining",
          description: `Your protein intake has dropped compared to earlier this week. Average: ${mealPatterns.averageProteinPerDay}g vs goal of ${proteinGoal}g.`,
          action: `Reverse this today: Plan ${Math.round(proteinGoal / averageMealsPerDay)}g protein per meal. Front-load protein at breakfast and lunch.`,
          priority: 2,
        });
      } else if (proteinTrend === "improving") {
        recommendations.push({
          type: "positive",
          icon: <TrendingUp className="w-5 h-5 text-primary" />,
          title: "Protein Trend Improving",
          description: `Great progress! Your protein intake is trending up. Keep building on this momentum.`,
          priority: 5,
        });
      }

      // Weekend vs weekday coaching (only on weekends)
      if (isWeekend && weekendVsWeekday.weekdayAvgCalories > 0) {
        const weekendCalorieDiff = weekendVsWeekday.weekendAvgCalories - weekendVsWeekday.weekdayAvgCalories;
        const weekendProteinDiff = weekendVsWeekday.weekendAvgProtein - weekendVsWeekday.weekdayAvgProtein;
        
        if (weekendCalorieDiff > 300) {
          recommendations.push({
            type: "warning",
            icon: <Calendar className="w-5 h-5 text-amber-500" />,
            title: "Weekend Pattern Alert",
            description: `Your data shows weekends average +${weekendCalorieDiff} kcal vs weekdays. This can undo weekly progress.`,
            details: `Weekend patterns are one of the most common reasons people plateau. Social events, relaxed routines, and reward eating all contribute.`,
            action: `Today's strategy: Keep logging, aim for ${calorieGoal} kcal and ${proteinGoal}g protein. One planned indulgence is fine—just track it.`,
            priority: 2,
          });
        }
        if (weekendProteinDiff < -20) {
          recommendations.push({
            type: "info",
            icon: <Flame className="w-5 h-5 text-secondary" />,
            title: "Weekend Protein Dip",
            description: `Weekends you average ${Math.abs(weekendProteinDiff)}g less protein. Keep protein high today for consistency.`,
            action: `Easy weekend protein: eggs at brunch, Greek yogurt snack, grilled meat at dinner.`,
            priority: 3,
          });
        }
      }

      // Meal pattern coaching
      if (averageProteinByMealNumber[0] < proteinGoal * 0.2) {
        recommendations.push({
          type: "action",
          icon: <Utensils className="w-5 h-5 text-secondary" />,
          title: "Breakfast Protein Opportunity",
          description: `Your first meal averages only ${averageProteinByMealNumber[0]}g protein. Front-loading protein improves satiety and energy all day.`,
          action: `Target ${Math.round(proteinGoal * 0.3)}g at breakfast: 3-egg omelet (18g), Greek yogurt (17g), or protein shake (25g).`,
          priority: 3,
        });
      }

      // Consistency coaching
      if (proteinConsistency === "low") {
        recommendations.push({
          type: "info",
          icon: <Activity className="w-5 h-5 text-primary" />,
          title: "Protein Varies Day-to-Day",
          description: `Your protein intake swings a lot between days. Consistency beats occasional perfect days.`,
          action: `Set a daily protein floor: Minimum ${Math.round(proteinGoal * 0.8)}g even on "off" days. Prep protein options in advance.`,
          priority: 4,
        });
      }
    }

    // === NEW USER ONBOARDING COACHING ===
    if (accountAgeDays <= 7 && !hasMeals) {
      recommendations.push({
        type: "info",
        icon: <Lightbulb className="w-5 h-5 text-secondary" />,
        title: `Welcome${firstName ? `, ${firstName}` : ''}! Let's Build Momentum`,
        description: `You're ${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'} into your journey. The first week is about building the habit of logging—perfection comes later.`,
        details: `Your personalized targets: ${calorieGoal} kcal, ${proteinGoal}g protein, ${baseline?.water_liters || 2.5}L water daily. Based on your ${primaryGoal?.replace(/_/g, ' ') || 'goals'}.`,
        action: `Start simple: Log your next meal, even if it's just a rough estimate. Every logged meal teaches me more about your patterns.`,
        priority: 1,
      });
    }

    // === OCCUPATION-BASED COACHING ===
    const occupation = baseline?.occupation;
    const workHours = baseline?.work_hours;
    if (occupation && hour >= 11 && hour <= 14) {
      if (occupation === "desk_job" || occupation === "office") {
        recommendations.push({
          type: "info",
          icon: <Activity className="w-5 h-5 text-primary" />,
          title: "Desk Worker Tip",
          description: `Sedentary work means your body needs movement to optimize digestion and energy.`,
          action: `After lunch: 10-min walk. Stand for 5 min every hour. This boosts metabolism and focus.`,
          priority: 4,
        });
      } else if (occupation === "active" || occupation === "physical") {
        recommendations.push({
          type: "info",
          icon: <Flame className="w-5 h-5 text-secondary" />,
          title: "Active Job = Higher Needs",
          description: `Your physical work burns extra calories. Make sure you're fueling adequately.`,
          action: `Bring portable protein: nuts, protein bars, jerky. Don't skip lunch—your body needs it.`,
          priority: 4,
        });
      }
    }

    // === TRAINING DAY COACHING ===
    const trainingDays = baseline?.training_days;
    const trainingIntensity = baseline?.training_intensity;
    const dayOfWeek = new Date().getDay();
    const trainingDaysNum = trainingDays ? parseInt(trainingDays) : 0;
    
    // Assume training on weekdays if training 3-5 days
    const likelyTrainingDay = trainingDaysNum >= 3 && dayOfWeek >= 1 && dayOfWeek <= 5;
    
    if (likelyTrainingDay && trainingIntensity) {
      const isHighIntensity = trainingIntensity === "high" || trainingIntensity === "intense";
      recommendations.push({
        type: "info",
        icon: <Activity className="w-5 h-5 text-primary" />,
        title: isHighIntensity ? "High-Intensity Training Day" : "Training Day Fuel",
        description: isHighIntensity 
          ? `Intense training requires extra carbs for performance and protein for recovery.`
          : `Training today? Make sure you're properly fueled before and after.`,
        action: isHighIntensity
          ? `Pre-workout: ${Math.round(carbsGoal * 0.25)}g carbs 1-2h before. Post-workout: ${Math.round(proteinGoal * 0.25)}g protein within 1h.`
          : `Include protein + carbs in your post-workout meal for optimal recovery.`,
        priority: 3,
      });
    }

    // Deduplicate recommendations by category to ensure variety
    // Categories: protein, calories, water, sleep, energy, stress, behavior, trend, goal
    const categorize = (rec: InsightCard): string => {
      const title = rec.title.toLowerCase();
      if (title.includes('protein')) return 'protein';
      if (title.includes('calorie') || title.includes('kcal')) return 'calories';
      if (title.includes('water') || title.includes('hydration')) return 'water';
      if (title.includes('sleep')) return 'sleep';
      if (title.includes('energy')) return 'energy';
      if (title.includes('stress')) return 'stress';
      if (title.includes('weekend') || title.includes('pattern')) return 'pattern';
      if (title.includes('trend') || title.includes('improving') || title.includes('declining')) return 'trend';
      if (title.includes('goal') || title.includes('target') || title.includes('today')) return 'goal';
      return 'other';
    };

    // Sort by priority first
    const sorted = recommendations.sort((a, b) => a.priority - b.priority);
    
    // Select up to 4 recommendations, ensuring each is from a different category
    const selected: InsightCard[] = [];
    const usedCategories = new Set<string>();
    
    for (const rec of sorted) {
      if (selected.length >= 4) break;
      const category = categorize(rec);
      if (!usedCategories.has(category)) {
        selected.push(rec);
        usedCategories.add(category);
      }
    }
    
    // If we have fewer than 4 due to limited categories, allow duplicates from highest priority remaining
    if (selected.length < 4) {
      for (const rec of sorted) {
        if (selected.length >= 4) break;
        if (!selected.includes(rec)) {
          selected.push(rec);
        }
      }
    }

    return selected;
  };

  // Now generates recommendations from meal/water data even without check-in
  const actionableRecommendations = generateActionableRecommendations();
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

        {/* Daily Focus Points from today's check-in AI response (takes highest priority) */}
        {dailyCheckInFocusPoints && dailyCheckInFocusPoints.length > 0 ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-secondary" />
              <span className="text-base font-bold text-foreground">
                Today's Coaching Plan
              </span>
            </div>
            <div className="space-y-2">
              {dailyCheckInFocusPoints.slice(0, 4).map((point, index) => {
                // Add real-time progress indicators for focus points
                const textLower = point.text.toLowerCase();
                let progressIndicator: React.ReactNode = null;
                
                // Detect protein-related focus points
                if (textLower.includes('protein') || textLower.includes('g protein')) {
                  const percent = Math.min(100, proteinPercent);
                  progressIndicator = (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className={percent >= 100 ? 'text-green-500 font-medium' : 'text-foreground'}>
                          {totalProtein}g / {proteinGoal}g ({percent}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary/20 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${percent >= 100 ? 'bg-green-500' : 'bg-secondary'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                
                // Detect water-related focus points
                if (textLower.includes('water') || textLower.includes('hydrat') || textLower.includes(' l ') || /\d+\.?\d*l/i.test(textLower)) {
                  const percent = Math.min(100, waterPercent);
                  const waterGoalL = (baseline?.water_liters || 2.5);
                  progressIndicator = (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className={percent >= 100 ? 'text-green-500 font-medium' : 'text-foreground'}>
                          {(waterIntakeMl / 1000).toFixed(1)}L / {waterGoalL}L ({percent}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${percent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                
                // Detect calorie-related focus points
                if (textLower.includes('calori') || textLower.includes('kcal') || textLower.includes('energy intake')) {
                  const percent = Math.min(100, calPercent);
                  progressIndicator = (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className={percent >= 90 && percent <= 110 ? 'text-green-500 font-medium' : 'text-foreground'}>
                          {totalCalories} / {calorieGoal} kcal ({percent}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${percent >= 90 && percent <= 110 ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div 
                    key={index}
                    className="p-3 rounded-xl border border-secondary/20 bg-secondary/5 animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg flex-shrink-0">{point.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{point.text}</p>
                        {point.tip && (
                          <p className="text-xs text-muted-foreground mt-1">→ {point.tip}</p>
                        )}
                        {progressIndicator}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : customFocusPoints && customFocusPoints.length > 0 ? (
          /* Monthly Focus Points from Progress Update */
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-base font-bold text-foreground">
                Your Monthly Focus
              </span>
            </div>
            <div className="space-y-2">
              {customFocusPoints.slice(0, 4).map((point, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-xl border border-primary/20 bg-primary/5 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{point.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{point.text}</p>
                      {point.tip && (
                        <p className="text-xs text-muted-foreground mt-1">→ {point.tip}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : hasRecommendations && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-secondary" />
              <span className="text-base font-bold text-foreground">
                Today's Coaching Plan
              </span>
            </div>

            <div className="space-y-3">
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
                      {/* Title/Warning */}
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(rec.type)}
                        <h4 className="font-semibold text-sm text-foreground">{rec.title}</h4>
                      </div>
                      {/* Action Step Only */}
                      {rec.action && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {rec.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
