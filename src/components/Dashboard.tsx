import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { AddMealCard } from "@/components/MealCard";
import { CollapsibleMealCard } from "@/components/CollapsibleMealCard";
import { AICoachCard } from "@/components/AICoachCard";
import { AICoachChat } from "@/components/AICoachChat";
import { MealLogger } from "@/components/MealLogger";
import { SettingsSheet } from "@/components/SettingsSheet";
import { StreakCard } from "@/components/StreakCard";
import { StreakCelebration } from "@/components/StreakCelebration";
import { WaterTracker } from "@/components/WaterTracker";
import { MealPlanner } from "@/components/MealPlanner";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { WearableSettings } from "@/components/WearableSettings";
import { TrialBanner } from "@/components/TrialBanner";
import { RecalibrationNotification } from "@/components/RecalibrationNotification";
import { DEFAULT_LAYOUT } from "@/components/DashboardLayoutSettings";


import { Bell, Flame, TrendingUp, Sun, Watch } from "lucide-react";
import { saveMeal, getTodaysMeals, updateMeal, deleteMeal, MealInput, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getStreaks, updateStreak, UserStreak } from "@/lib/streakService";
import { getTodaysCheckIn, getRecentCheckIns, analyzeCheckIns, CheckInAnalysis, UserTargets, DailyCheckIn as DailyCheckInType } from "@/lib/checkinService";
import { getTodaysWearableData, getWearableConnections, type WearableSummary } from "@/lib/wearableService";
import { getTodaysWaterIntake } from "@/lib/waterService";
import { checkRecalibrationNeeded, RecalibrationResult } from "@/lib/baselineRecalibration";
import { analyzeMealPatterns, getAccountAgeDays, MealPatternAnalysis } from "@/lib/coachingAnalytics";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface DashboardMeal {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  imageUrl?: string;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { subscription, subscriptionEnd, subscriptionLoading, checkSubscription, isTrialing, trialDaysRemaining, trialEnd } = useAuth();
  const [showMealLogger, setShowMealLogger] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [freshCheckInData, setFreshCheckInData] = useState<{
    mood: number;
    energy_level: number;
    sleep_quality: number;
    stress_level: number;
    sleep_hours?: number;
    hunger_level?: number;
    notes?: string;
    check_in_date: string;
  } | null>(null);
  const [meals, setMeals] = useState<DashboardMeal[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [loginStreak, setLoginStreak] = useState<UserStreak | null>(null);
  const [coachingStreak, setCoachingStreak] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [todaysCheckIn, setTodaysCheckIn] = useState<DailyCheckInType | null>(null);
  const [showWearableSettings, setShowWearableSettings] = useState(false);
  const [wearableData, setWearableData] = useState<WearableSummary | null>(null);
  const [hasWearableConnections, setHasWearableConnections] = useState(false);
  const [checkInAnalysis, setCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [recalibrationResult, setRecalibrationResult] = useState<RecalibrationResult | null>(null);
  const [showRecalibration, setShowRecalibration] = useState(false);
  const [totalWaterMl, setTotalWaterMl] = useState(0);
  const [mealPatterns, setMealPatterns] = useState<MealPatternAnalysis | null>(null);
  const [accountAgeDays, setAccountAgeDays] = useState(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  // Get user's first name for personalization
  const firstName = baseline?.name?.split(' ')[0] || '';

  // Dynamic Coach Mac greeting based on current data
  const generateCoachGreeting = () => {
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinPercent = Math.round((totalProtein / proteinGoal) * 100);
    const waterPercent = Math.round((totalWaterMl / waterGoal) * 100);
    const hour = new Date().getHours();
    
    // Celebrate complete goals
    if (calPercent >= 95 && proteinPercent >= 95 && waterPercent >= 90) {
      return `🏆 ${firstName ? `${firstName}, you're` : "You're"} crushing it! All goals nearly complete!`;
    }
    
    // Morning states
    if (hour < 10) {
      if (meals.length === 0 && !hasCheckedInToday) {
        return `${getGreeting()}${firstName ? `, ${firstName}` : ''}! Start strong — check in and log breakfast.`;
      }
      if (meals.length === 0 && hasCheckedInToday) {
        return `Great check-in${firstName ? `, ${firstName}` : ''}! Now fuel up with a protein-rich breakfast.`;
      }
      if (meals.length > 0) {
        return `Nice start${firstName ? `, ${firstName}` : ''}! You're at ${calPercent}% of calories. Keep going!`;
      }
    }
    
    // Midday states  
    if (hour >= 10 && hour < 14) {
      if (calPercent < 25) {
        return `${firstName ? `${firstName}, you` : 'You'} need fuel! Only ${calPercent}% of calories logged.`;
      }
      if (proteinPercent < 30 && calPercent >= 25) {
        return `Protein check: ${totalProtein}g/${proteinGoal}g. Add protein to your next meal!`;
      }
    }
    
    // Afternoon states
    if (hour >= 14 && hour < 18) {
      if (calPercent < 50) {
        return `⚠️ Afternoon alert: Only ${calPercent}% of calories. Don't under-fuel!`;
      }
      if (waterPercent < 50) {
        return `💧 Hydration check: ${Math.round(totalWaterMl/1000 * 10)/10}L/${baseline?.water_liters || 2.5}L. Drink up!`;
      }
      if (proteinPercent >= 80) {
        return `💪 Protein on point${firstName ? `, ${firstName}` : ''}! ${proteinPercent}% complete.`;
      }
    }
    
    // Evening states
    if (hour >= 18) {
      const proteinRemaining = proteinGoal - totalProtein;
      if (proteinPercent < 70) {
        return `Evening push: ${proteinRemaining}g protein to go. High-protein dinner time!`;
      }
      if (calPercent >= 90 && proteinPercent >= 90) {
        return `Almost there${firstName ? `, ${firstName}` : ''}! Finish strong tonight.`;
      }
    }
    
    // Check-in pattern based
    if (checkInAnalysis?.trends.energy === "declining") {
      return `Energy dropping this week. Focus on complex carbs and iron today.`;
    }
    
    // Default with personalization
    if (meals.length === 0) {
      return `${getGreeting()}${firstName ? `, ${firstName}` : ''}! Ready to start logging?`;
    }
    
    return `${getGreeting()}${firstName ? `, ${firstName}` : ''}! ${calPercent}% of calories, ${proteinPercent}% protein.`;
  };

  // Dynamic insights based on logged data - more specific and actionable
  const generateCoachInsights = (): string[] => {
    const insights: string[] = [];
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const carbsGoal = baseline?.carbs_grams || 200;
    const fatsGoal = baseline?.fats_grams || 65;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinRemaining = proteinGoal - totalProtein;
    const carbsRemaining = carbsGoal - totalCarbs;
    const fatsRemaining = fatsGoal - totalFats;
    const waterRemaining = Math.round((waterGoal - totalWaterMl) / 1000 * 10) / 10;
    
    const hour = new Date().getHours();
    const mealsRemaining = hour < 12 ? 3 : hour < 17 ? 2 : 1;
    
    // Protein-focused insights with specific numbers
    if (proteinRemaining > 0 && hour >= 10) {
      const proteinPerMeal = Math.round(proteinRemaining / mealsRemaining);
      if (proteinPerMeal > 40) {
        insights.push(`🎯 Need ${proteinRemaining}g protein across ${mealsRemaining} meals (~${proteinPerMeal}g each). Ideas: chicken breast (31g), Greek yogurt (17g), eggs (6g each).`);
      } else if (proteinRemaining > 20) {
        insights.push(`Need ${proteinRemaining}g more protein. Add lean meat, fish, or legumes to your next meal.`);
      }
    }
    
    if (totalProtein >= proteinGoal && totalProtein > 0) {
      insights.push(`✅ Protein goal hit${firstName ? `, ${firstName}` : ''}! ${totalProtein}g supports your ${baseline?.primary_goal?.replace(/_/g, ' ') || 'goals'}.`);
    }
    
    // Calorie insights with context
    if (calPercent < 30 && hour >= 14) {
      insights.push(`⚠️ Only ${totalCalories} kcal logged (${calPercent}%). Under-eating affects energy and metabolism.`);
    } else if (totalCalories > calorieGoal) {
      const excess = totalCalories - calorieGoal;
      insights.push(`You're ${excess} kcal over target. Focus on protein-rich, lower-cal foods for any remaining meals.`);
    }
    
    // Water insight
    if (waterRemaining > 1 && hour >= 12) {
      insights.push(`💧 ${waterRemaining}L water to go. Set hourly reminders to stay hydrated.`);
    } else if (totalWaterMl >= waterGoal * 0.9) {
      insights.push(`💧 Hydration on point! ${Math.round(totalWaterMl/1000 * 10)/10}L logged.`);
    }
    
    // Macro balance check
    if (meals.length >= 2) {
      const fatPercent = Math.round((totalFats / fatsGoal) * 100);
      const carbPercent = Math.round((totalCarbs / carbsGoal) * 100);
      if (fatPercent > carbPercent + 30) {
        insights.push(`Carbs are low relative to fats. Add complex carbs (oats, rice, potatoes) for sustained energy.`);
      }
    }
    
    // Check-in based insights
    if (todaysCheckIn) {
      if (todaysCheckIn.energy_level && todaysCheckIn.energy_level <= 2) {
        insights.push(`Low energy today → prioritize complex carbs and iron-rich foods (spinach, legumes, red meat).`);
      }
      if (todaysCheckIn.stress_level && todaysCheckIn.stress_level >= 4) {
        insights.push(`High stress detected → omega-3s (salmon, walnuts) and magnesium (dark chocolate, almonds) can help.`);
      }
    }
    
    // Default insights if none generated
    if (insights.length === 0) {
      if (meals.length === 0) {
        insights.push(`Log your first meal to get personalized guidance${firstName ? `, ${firstName}` : ''}.`);
      } else {
        insights.push(`${meals.length} meal${meals.length > 1 ? 's' : ''} logged (${totalCalories} kcal). You're on track!`);
      }
    }
    
    return insights.slice(0, 3);
  };

  // Dynamic tip based on current progress and check-in data
  const generateCoachTip = (): string => {
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinPercent = Math.round((totalProtein / proteinGoal) * 100);
    const waterPercent = Math.round((totalWaterMl / waterGoal) * 100);
    const hour = new Date().getHours();
    
    // Check-in trend based tips (highest priority)
    if (checkInAnalysis?.trends.energy === "declining") {
      return `💡 Energy declining this week. Today: prioritize ${Math.round((baseline?.carbs_grams || 200) * 0.4)}g carbs before 3pm.`;
    }
    if (checkInAnalysis?.trends.sleep === "declining") {
      return `💡 Sleep trending down. Tonight: magnesium-rich dinner, no caffeine after 2pm, ${baseline?.water_liters || 2.5}L water.`;
    }
    if (todaysCheckIn?.stress_level && todaysCheckIn.stress_level >= 4) {
      return `💡 Stress is high today. Skip sugar, add omega-3s at dinner, and take a 10-min walk after eating.`;
    }
    
    // Real-time progress tips
    if (hour < 10 && meals.length === 0) {
      return `💡 Morning tip: ${Math.round((baseline?.protein_grams || 120) * 0.25)}g protein at breakfast = fewer cravings later.`;
    }
    
    if (hour >= 10 && hour < 14 && proteinPercent < 25) {
      return `💡 Protein check: Only ${totalProtein}g logged. Add eggs, Greek yogurt, or chicken to lunch.`;
    }
    
    if (hour >= 14 && hour < 16 && calPercent < 50) {
      return `💡 Under 50% calories by afternoon = energy crash. Eat a balanced meal NOW.`;
    }
    
    if (hour >= 14 && waterPercent < 40) {
      return `💡 Drink ${Math.round((waterGoal - totalWaterMl) / 2 / 1000 * 10)/10}L water in the next 2 hours. Dehydration mimics hunger.`;
    }
    
    if (hour >= 18 && proteinPercent < 70) {
      return `💡 Need ${proteinGoal - totalProtein}g protein before bed. High-protein dinner = better recovery.`;
    }
    
    // Celebration tips
    if (calPercent >= 90 && proteinPercent >= 90 && waterPercent >= 80) {
      return `💡 Nearly perfect day${firstName ? `, ${firstName}` : ''}! Finish with a light, protein-rich meal.`;
    }
    
    if (proteinPercent >= 100 && calPercent < 90) {
      return `💡 Protein goal smashed! Fill remaining ${calorieGoal - totalCalories} kcal with veggies and healthy fats.`;
    }
    
    // Behavioral pattern tips
    if (baseline?.biggest_challenge === "evening_snacking" && hour >= 18) {
      return `💡 Evening snacking is your challenge. Pre-plan: protein snack ready, no grazing after 9pm.`;
    }
    
    if (baseline?.eating_speed === "fast") {
      return `💡 You eat fast — slow down! 20+ chews per bite, put fork down between bites.`;
    }
    
    return `💡 You're at ${calPercent}% calories, ${proteinPercent}% protein. ${meals.length < 3 ? 'Keep logging!' : 'Nice consistency!'}`;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dbMeals, userBaseline, streaks, checkInData, wearable, wearableConns, recentCheckIns, waterData] = await Promise.all([
        getTodaysMeals(),
        getUserBaseline(),
        getStreaks(),
        getTodaysCheckIn(),
        getTodaysWearableData(),
        getWearableConnections(),
        getRecentCheckIns(7),
        getTodaysWaterIntake(),
      ]);
      
      setHasCheckedInToday(!!checkInData);
      setTodaysCheckIn(checkInData);
      setWearableData(wearable);
      setHasWearableConnections(wearableConns.length > 0);
      setTotalWaterMl(waterData.reduce((sum, w) => sum + w.amount_ml, 0));
      
      // Set baseline and calculate account age
      setBaseline(userBaseline);
      if (userBaseline) {
        setAccountAgeDays(getAccountAgeDays(userBaseline));
        
        // Analyze meal patterns from the past week (non-blocking)
        analyzeMealPatterns(userBaseline).then(patterns => {
          setMealPatterns(patterns);
        });
      }
      
      // Analyze check-in data for AI coach insights with user-specific targets
      if (recentCheckIns.length > 0) {
        const userTargets: UserTargets = {
          targetCalories: userBaseline?.target_calories || undefined,
          proteinGrams: userBaseline?.protein_grams || undefined,
          carbsGrams: userBaseline?.carbs_grams || undefined,
          fatsGrams: userBaseline?.fats_grams || undefined,
          waterLiters: userBaseline?.water_liters || undefined,
          sleepHours: userBaseline?.sleep_hours || undefined,
        };
        const analysis = analyzeCheckIns(recentCheckIns, userTargets);
        setCheckInAnalysis(analysis);
      }
      
      // Update login streak on dashboard load
      updateStreak('login').then(streak => {
        if (streak) {
          setLoginStreak(streak);
          
          // Only show celebration once per day
          const today = new Date().toDateString();
          const lastCelebration = localStorage.getItem('cjt_streak_celebration_date');
          
          if (lastCelebration !== today) {
            setShowStreakCelebration(true);
            localStorage.setItem('cjt_streak_celebration_date', today);
          }
        }
      });
      
      // Set streaks from database
      const login = streaks.find(s => s.streak_type === 'login');
      const coaching = streaks.find(s => s.streak_type === 'coaching');
      if (login) setLoginStreak(login);
      if (coaching) setCoachingStreak(coaching);
      
      const formattedMeals: DashboardMeal[] = dbMeals.map((meal: Meal) => ({
        id: meal.id,
        name: meal.name,
        time: new Date(meal.logged_at).toLocaleTimeString("en-US", { 
          hour: "numeric", 
          minute: "2-digit" 
        }),
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        imageUrl: meal.image_url || undefined,
      }));
      
      setMeals(formattedMeals);
      
      // Check for baseline recalibration (every 2 weeks)
      if (userBaseline) {
        const lastCheck = localStorage.getItem('cjt_recalibration_check');
        const today = new Date().toDateString();
        if (lastCheck !== today) {
          localStorage.setItem('cjt_recalibration_check', today);
          checkRecalibrationNeeded(userBaseline).then(result => {
            if (result.shouldRecalibrate) {
              setRecalibrationResult(result);
              setShowRecalibration(true);
            }
          });
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFats = meals.reduce((sum, m) => sum + m.fats, 0);

  const handleAddMeal = async (meal: MealInput) => {
    try {
      const savedMeal = await saveMeal(meal);
      if (savedMeal) {
        const newMeal: DashboardMeal = {
          id: savedMeal.id,
          name: savedMeal.name,
          time: new Date(savedMeal.logged_at).toLocaleTimeString("en-US", { 
            hour: "numeric", 
            minute: "2-digit" 
          }),
          calories: savedMeal.calories,
          protein: savedMeal.protein,
          carbs: savedMeal.carbs,
          fats: savedMeal.fats,
          imageUrl: savedMeal.image_url || undefined,
        };
        
        const updatedMeals = [...meals, newMeal];
        setMeals(updatedMeals);
        
        // Calculate new totals after adding meal
        const newTotalCalories = updatedMeals.reduce((sum, m) => sum + m.calories, 0);
        const newTotalProtein = updatedMeals.reduce((sum, m) => sum + m.protein, 0);
        const newTotalCarbs = updatedMeals.reduce((sum, m) => sum + m.carbs, 0);
        const newTotalFats = updatedMeals.reduce((sum, m) => sum + m.fats, 0);
        
        // Check if goals were just reached
        const calorieGoal = baseline?.target_calories || 2000;
        const proteinGoal = baseline?.protein_grams || 120;
        const carbsGoal = baseline?.carbs_grams || 200;
        const fatsGoal = baseline?.fats_grams || 65;
        
        // Celebrate goal achievements
        if (newTotalCalories >= calorieGoal && totalCalories < calorieGoal) {
          toast.success("🎉 Amazing! You've hit your calorie goal for today!", { duration: 5000 });
        }
        if (newTotalProtein >= proteinGoal && totalProtein < proteinGoal) {
          toast.success("💪 Protein goal crushed! Great job fueling your muscles!", { duration: 5000 });
        }
        if (newTotalCarbs >= carbsGoal && totalCarbs < carbsGoal) {
          toast.success("⚡ Carb goal reached! Your energy stores are topped up!", { duration: 5000 });
        }
        if (newTotalFats >= fatsGoal && totalFats < fatsGoal) {
          toast.success("🥑 Healthy fats goal achieved! Your body thanks you!", { duration: 5000 });
        }
        
        // All macros complete celebration
        if (newTotalCalories >= calorieGoal && newTotalProtein >= proteinGoal && 
            newTotalCarbs >= carbsGoal && newTotalFats >= fatsGoal &&
            !(totalCalories >= calorieGoal && totalProtein >= proteinGoal && 
              totalCarbs >= carbsGoal && totalFats >= fatsGoal)) {
          setTimeout(() => {
            toast.success("🏆 PERFECT DAY! All nutrition goals completed!", { 
              duration: 6000,
              style: { background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }
            });
          }, 1000);
        }
        
        toast.success(t('meal_logged'));
      }
    } catch (error) {
      console.error("Error saving meal:", error);
      toast.error(t('error'));
    }
  };

  const handleEditMeal = async (editedMeal: DashboardMeal) => {
    try {
      await updateMeal(editedMeal.id, {
        name: editedMeal.name,
        calories: editedMeal.calories,
        protein: editedMeal.protein,
        carbs: editedMeal.carbs,
        fats: editedMeal.fats,
      });
      setMeals(prev => prev.map(m => m.id === editedMeal.id ? editedMeal : m));
      toast.success(t('meal_updated'));
    } catch (error) {
      console.error("Error updating meal:", error);
      toast.error(t('error'));
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMeal(mealId);
      setMeals(prev => prev.filter(m => m.id !== mealId));
      toast.success(t('meal_deleted'));
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast.error(t('error'));
    }
  };

  // Get layout preferences
  const layout = baseline?.dashboard_layout || DEFAULT_LAYOUT;
  const visibleSections = layout.sections.filter(s => !layout.hidden.includes(s));

  // Section rendering helpers
  const renderProgressSection = () => (
    <section key="progress" className="bg-card rounded-3xl shadow-medium p-6 animate-scale-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('todays_progress')}</h2>
          <p className="text-sm text-muted-foreground">{t('keep_up_great_work')}</p>
        </div>
      </div>
      <div className="flex justify-around items-center">
        <MacroRing 
          value={totalCalories} 
          max={baseline?.target_calories || 2000} 
          label={t('calories')} 
          color="calories"
          size="lg"
          unit=""
        />
        <div className="space-y-4">
          <MacroRing 
            value={totalProtein} 
            max={baseline?.protein_grams || 120} 
            label={t('protein')} 
            color="protein"
            size="sm"
          />
          <MacroRing 
            value={totalCarbs} 
            max={baseline?.carbs_grams || 200} 
            label={t('carbs')} 
            color="carbs"
            size="sm"
          />
          <MacroRing 
            value={totalFats} 
            max={baseline?.fats_grams || 65} 
            label={t('fats')} 
            color="fats"
            size="sm"
          />
        </div>
      </div>
    </section>
  );

  const renderMealsSection = () => (
    <section key="meals">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">{t('todays_meals')}</h2>
        <button 
          onClick={() => navigate("/history")}
          className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
        >
          {t('view_all')}
          <TrendingUp className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('loading_meals')}</div>
        ) : meals.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {t('no_meals_yet')}
          </div>
        ) : (
          meals.map((meal, index) => (
            <div key={meal.id} style={{ animationDelay: `${index * 100}ms` }}>
              <CollapsibleMealCard 
                meal={meal} 
                onEdit={handleEditMeal}
                onDelete={handleDeleteMeal}
              />
            </div>
          ))
        )}
        <AddMealCard onClick={() => setShowMealLogger(true)} />
      </div>
    </section>
  );

  const renderCoachSection = () => (
    <section key="coach">
      <AICoachCard 
        greeting={generateCoachGreeting()}
        insights={generateCoachInsights()}
        tip={generateCoachTip()}
        onChatOpen={() => {
          setShowAIChat(true);
          updateStreak('coaching').then(streak => {
            if (streak) setCoachingStreak(streak);
          });
        }}
        todaysCheckIn={todaysCheckIn}
        analysis={checkInAnalysis}
        baseline={baseline}
        meals={meals}
        waterIntakeMl={totalWaterMl}
        mealPatterns={mealPatterns}
        accountAgeDays={accountAgeDays}
      />
    </section>
  );

  const renderPlannerSection = () => (
    <section key="planner">
      <MealPlanner baseline={baseline} />
    </section>
  );

  const renderWaterSection = () => (
    <section key="water">
      <WaterTracker dailyGoalLiters={baseline?.water_liters || 2.5} />
    </section>
  );

  const renderWearablesSection = () => (
    <section key="wearables" className="mb-2">
      <button
        onClick={() => setShowWearableSettings(true)}
        className="w-full p-4 glass rounded-2xl border border-border/50 flex items-center gap-4 hover:bg-accent/10 transition-colors"
      >
        <div className="text-2xl">⌚</div>
        <div className="text-left flex-1">
          <h4 className="font-semibold text-foreground">{t('wearables')}</h4>
          {wearableData ? (
            <p className="text-sm text-muted-foreground">
              {wearableData.sleepHours && `${wearableData.sleepHours}h ${t('sleep')}`}
              {wearableData.hrv && ` • HRV ${wearableData.hrv}ms`}
              {wearableData.steps && ` • ${wearableData.steps.toLocaleString()} steps`}
            </p>
          ) : hasWearableConnections ? (
            <p className="text-sm text-muted-foreground">{t('waiting_sync')}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('connect_wearables')}</p>
          )}
        </div>
        {wearableData && (
          <span className="text-xs text-green-500 font-medium">{t('synced')}</span>
        )}
      </button>
    </section>
  );

  const sectionRenderers: Record<string, () => JSX.Element> = {
    progress: renderProgressSection,
    meals: renderMealsSection,
    coach: renderCoachSection,
    planner: renderPlannerSection,
    water: renderWaterSection,
    wearables: renderWearablesSection,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">{getGreeting()},</p>
            <h1 className="text-xl font-bold text-foreground">
              {baseline?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-muted rounded-xl transition-colors relative">
              <Bell className="w-6 h-6 text-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full" />
            </button>
            <SettingsSheet 
              baseline={baseline} 
              onSettingsChange={loadData}
              subscribed={subscription}
              subscriptionEnd={subscriptionEnd}
              subscriptionLoading={subscriptionLoading}
              onRefreshSubscription={checkSubscription}
            />
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Trial Banner */}
        {isTrialing && trialDaysRemaining !== null && trialEnd && (
          <TrialBanner daysRemaining={trialDaysRemaining} trialEnd={trialEnd} />
        )}
        {/* Check-In Prompt */}
        {!hasCheckedInToday && (
          <section>
            <button 
              onClick={() => setShowCheckIn(true)}
              className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4 hover:shadow-medium transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Sun className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-foreground">{t('morning_checkin')}</h3>
                <p className="text-sm text-muted-foreground">{t('how_feeling_today')}</p>
              </div>
              <div className="text-2xl">👋</div>
            </button>
          </section>
        )}

        {/* Recalibration Notification */}
        {showRecalibration && recalibrationResult && baseline && (
          <section>
            <RecalibrationNotification
              result={recalibrationResult}
              currentCalories={baseline.target_calories || 2000}
              onApply={() => {
                setShowRecalibration(false);
                loadData(); // Reload with new baseline
              }}
              onDismiss={() => setShowRecalibration(false)}
            />
          </section>
        )}

        {/* Dynamic Dashboard Sections */}
        {visibleSections.map(sectionId => {
          const renderer = sectionRenderers[sectionId];
          return renderer ? renderer() : null;
        })}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="container flex justify-around py-3">
          {[
            { icon: "🏠", label: t('home'), path: "/", active: true },
            { icon: "📊", label: t('progress'), path: "/progress", active: false },
            { icon: "🍽️", label: t('meals'), path: "/history", active: false },
            { icon: "👤", label: t('profile'), path: "/", active: false },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${
                item.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Meal Logger Modal */}
      {showMealLogger && (
        <MealLogger 
          onClose={() => setShowMealLogger(false)}
          onSubmit={handleAddMeal}
          userDietContext={{
            dietType: baseline?.diet_type || undefined,
            allergies: baseline?.allergies || undefined,
            foodDislikes: baseline?.food_dislikes || undefined,
          }}
        />
      )}

      {/* AI Coach Chat Modal */}
      {showAIChat && (
        <AICoachChat 
          onClose={() => {
            setShowAIChat(false);
            setFreshCheckInData(null);
          }} 
          freshCheckIn={freshCheckInData}
        />
      )}

      {/* Streak Celebration */}
      {showStreakCelebration && (
        <StreakCelebration 
          streak={loginStreak} 
          onClose={() => setShowStreakCelebration(false)} 
        />
      )}

      {/* Daily Check-In Modal */}
      {showCheckIn && (
        <DailyCheckIn 
          onClose={() => setShowCheckIn(false)}
          onComplete={(checkInData) => {
            setShowCheckIn(false);
            setHasCheckedInToday(true);
            // Store check-in for insights component
            setTodaysCheckIn({
              check_in_date: checkInData.check_in_date,
              mood: checkInData.mood,
              energy_level: checkInData.energy_level,
              sleep_quality: checkInData.sleep_quality,
              stress_level: checkInData.stress_level,
              sleep_hours: checkInData.sleep_hours,
              hunger_level: checkInData.hunger_level,
              notes: checkInData.notes,
            });
            // Immediately open AI chat with fresh check-in data
            setFreshCheckInData(checkInData);
            setShowAIChat(true);
            // Update coaching streak
            updateStreak('coaching').then(streak => {
              if (streak) setCoachingStreak(streak);
            });
            // Refresh analysis with new check-in
            getRecentCheckIns(7).then(recentCheckIns => {
              if (recentCheckIns.length > 0 && baseline) {
                const userTargets: UserTargets = {
                  targetCalories: baseline?.target_calories || undefined,
                  proteinGrams: baseline?.protein_grams || undefined,
                  carbsGrams: baseline?.carbs_grams || undefined,
                  fatsGrams: baseline?.fats_grams || undefined,
                  waterLiters: baseline?.water_liters || undefined,
                  sleepHours: baseline?.sleep_hours || undefined,
                };
                setCheckInAnalysis(analyzeCheckIns(recentCheckIns, userTargets));
              }
            });
          }}
        />
      )}

      {/* Wearable Settings Modal */}
      {showWearableSettings && (
        <WearableSettings onClose={() => setShowWearableSettings(false)} />
      )}
    </div>
  );
};
