import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { AddMealCard } from "@/components/MealCard";
import { CollapsibleMealCard } from "@/components/CollapsibleMealCard";
import { AICoachCard } from "@/components/AICoachCard";
import { AICoachChat } from "@/components/AICoachChat";
import { MealLogger } from "@/components/MealLogger";
import { SettingsSheet } from "@/components/SettingsSheet";
import { StreakCelebration } from "@/components/StreakCelebration";
import { WaterTracker } from "@/components/WaterTracker";

import { DailyCheckIn } from "@/components/DailyCheckIn";
import { TrialBanner } from "@/components/TrialBanner";
import { RecalibrationNotification } from "@/components/RecalibrationNotification";
import { ProgressUpdateDialog } from "@/components/ProgressUpdateDialog";
import { InstagramRecipeImport } from "@/components/InstagramRecipeImport";
import { DEFAULT_LAYOUT } from "@/components/DashboardLayoutSettings";
import { useShareHandler } from "@/hooks/useShareHandler";

import { Flame, TrendingUp, Sun, Instagram } from "lucide-react";
import { saveMeal, getTodaysMeals, updateMeal, deleteMeal, MealInput, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getStreaks, updateStreak, UserStreak } from "@/lib/streakService";
import { getTodaysCheckIn, getRecentCheckIns, analyzeCheckIns, getTodaysDailyFocusPoints, CheckInAnalysis, UserTargets, DailyCheckIn as DailyCheckInType } from "@/lib/checkinService";

import { getTodaysWaterIntake } from "@/lib/waterService";
import { checkRecalibrationNeeded, RecalibrationResult } from "@/lib/baselineRecalibration";
import { analyzeMealPatterns, getAccountAgeDays, MealPatternAnalysis } from "@/lib/coachingAnalytics";
import { getActiveCoachingFocusPoints, CoachingFocusPoint } from "@/lib/progressUpdateService";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getMealEncouragement } from "@/lib/encouragementMessages";

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

export const TodayDashboard = () => {
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
  const [checkInAnalysis, setCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [recalibrationResult, setRecalibrationResult] = useState<RecalibrationResult | null>(null);
  const [showRecalibration, setShowRecalibration] = useState(false);
  const [totalWaterMl, setTotalWaterMl] = useState(0);
  const [mealPatterns, setMealPatterns] = useState<MealPatternAnalysis | null>(null);
  const [accountAgeDays, setAccountAgeDays] = useState(0);
  const [showProgressUpdate, setShowProgressUpdate] = useState(false);
  const [customFocusPoints, setCustomFocusPoints] = useState<CoachingFocusPoint[] | null>(null);
  const [dailyCheckInFocusPoints, setDailyCheckInFocusPoints] = useState<CoachingFocusPoint[] | null>(null);
  const [showInstagramImport, setShowInstagramImport] = useState(false);
  
  const { sharedUrl, clearSharedUrl, isReady: shareHandlerReady } = useShareHandler();

  useEffect(() => {
    if (shareHandlerReady && sharedUrl && !isLoading) {
      setShowInstagramImport(true);
    }
  }, [sharedUrl, shareHandlerReady, isLoading]);

  const checkProgressUpdateNeeded = (userBaseline: UserBaseline | null) => {
    if (!userBaseline) return false;
    
    const lastUpdate = userBaseline.last_progress_update;
    if (!lastUpdate) {
      const createdAt = new Date(userBaseline.created_at);
      const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceCreation >= 30;
    }
    
    const lastUpdateDate = new Date(lastUpdate);
    const daysSinceUpdate = Math.floor((Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceUpdate >= 30;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  const firstName = baseline?.name?.split(' ')[0] || '';

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFats = meals.reduce((sum, m) => sum + m.fats, 0);

  const generateCoachGreeting = () => {
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinPercent = Math.round((totalProtein / proteinGoal) * 100);
    const waterPercent = Math.round((totalWaterMl / waterGoal) * 100);
    const hour = new Date().getHours();
    
    if (calPercent >= 95 && proteinPercent >= 95 && waterPercent >= 90) {
      return `🏆 ${firstName ? `${firstName}, you're` : "You're"} crushing it! All goals nearly complete!`;
    }
    
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
    
    if (hour >= 10 && hour < 14) {
      if (calPercent < 25) {
        return `${firstName ? `${firstName}, you` : 'You'} need fuel! Only ${calPercent}% of calories logged.`;
      }
      if (proteinPercent < 30 && calPercent >= 25) {
        return `Protein check: ${totalProtein}g/${proteinGoal}g. Add protein to your next meal!`;
      }
    }
    
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
    
    if (hour >= 18) {
      const proteinRemaining = proteinGoal - totalProtein;
      if (proteinPercent < 70) {
        return `Evening push: ${proteinRemaining}g protein to go. High-protein dinner time!`;
      }
      if (calPercent >= 90 && proteinPercent >= 90) {
        return `Almost there${firstName ? `, ${firstName}` : ''}! Finish strong tonight.`;
      }
    }
    
    if (checkInAnalysis?.trends.energy === "declining") {
      return `Energy dropping this week. Focus on complex carbs and iron today.`;
    }
    
    if (meals.length === 0) {
      return `${getGreeting()}${firstName ? `, ${firstName}` : ''}! Ready to start logging?`;
    }
    
    return `${getGreeting()}${firstName ? `, ${firstName}` : ''}! ${calPercent}% of calories, ${proteinPercent}% protein.`;
  };

  const generateCoachInsights = (): string[] => {
    const insights: string[] = [];
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const carbsGoal = baseline?.carbs_grams || 200;
    const fatsGoal = baseline?.fats_grams || 65;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinRemaining = proteinGoal - totalProtein;
    const waterRemaining = Math.round((waterGoal - totalWaterMl) / 1000 * 10) / 10;
    
    const hour = new Date().getHours();
    const mealsRemaining = hour < 12 ? 3 : hour < 17 ? 2 : 1;
    
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
    
    if (calPercent < 30 && hour >= 14) {
      insights.push(`⚠️ Only ${totalCalories} kcal logged (${calPercent}%). Under-eating affects energy and metabolism.`);
    } else if (totalCalories > calorieGoal) {
      const excess = totalCalories - calorieGoal;
      insights.push(`You're ${excess} kcal over target. Focus on protein-rich, lower-cal foods for any remaining meals.`);
    }
    
    if (waterRemaining > 1 && hour >= 12) {
      insights.push(`💧 ${waterRemaining}L water to go. Set hourly reminders to stay hydrated.`);
    } else if (totalWaterMl >= waterGoal * 0.9) {
      insights.push(`💧 Hydration on point! ${Math.round(totalWaterMl/1000 * 10)/10}L logged.`);
    }
    
    if (meals.length >= 2) {
      const fatPercent = Math.round((totalFats / fatsGoal) * 100);
      const carbPercent = Math.round((totalCarbs / carbsGoal) * 100);
      if (fatPercent > carbPercent + 30) {
        insights.push(`Carbs are low relative to fats. Add complex carbs (oats, rice, potatoes) for sustained energy.`);
      }
    }
    
    if (todaysCheckIn) {
      if (todaysCheckIn.energy_level && todaysCheckIn.energy_level <= 2) {
        insights.push(`Low energy today → prioritize complex carbs and iron-rich foods (spinach, legumes, red meat).`);
      }
      if (todaysCheckIn.stress_level && todaysCheckIn.stress_level <= 2) {
        insights.push(`Stress elevated → omega-3s (salmon, walnuts) and magnesium (dark chocolate, almonds) can help.`);
      }
    }
    
    if (insights.length === 0) {
      if (meals.length === 0) {
        insights.push(`Log your first meal to get personalized guidance${firstName ? `, ${firstName}` : ''}.`);
      } else {
        insights.push(`${meals.length} meal${meals.length > 1 ? 's' : ''} logged (${totalCalories} kcal). You're on track!`);
      }
    }
    
    return insights.slice(0, 3);
  };

  const generateCoachTip = (): string => {
    const calorieGoal = baseline?.target_calories || 2000;
    const proteinGoal = baseline?.protein_grams || 120;
    const waterGoal = (baseline?.water_liters || 2.5) * 1000;
    const calPercent = Math.round((totalCalories / calorieGoal) * 100);
    const proteinPercent = Math.round((totalProtein / proteinGoal) * 100);
    const waterPercent = Math.round((totalWaterMl / waterGoal) * 100);
    const hour = new Date().getHours();
    
    if (checkInAnalysis?.trends.energy === "declining") {
      return `💡 Energy declining this week. Today: prioritize ${Math.round((baseline?.carbs_grams || 200) * 0.4)}g carbs before 3pm.`;
    }
    if (checkInAnalysis?.trends.sleep === "declining") {
      return `💡 Sleep trending down. Tonight: magnesium-rich dinner, no caffeine after 2pm, ${baseline?.water_liters || 2.5}L water.`;
    }
    if (todaysCheckIn?.stress_level && todaysCheckIn.stress_level <= 2) {
      return `💡 Stress is high today. Skip sugar, add omega-3s at dinner, and take a 10-min walk after eating.`;
    }
    
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
    
    if (calPercent >= 90 && proteinPercent >= 90 && waterPercent >= 80) {
      return `💡 Nearly perfect day${firstName ? `, ${firstName}` : ''}! Finish with a light, protein-rich meal.`;
    }
    
    if (proteinPercent >= 100 && calPercent < 90) {
      return `💡 Protein goal smashed! Fill remaining ${calorieGoal - totalCalories} kcal with veggies and healthy fats.`;
    }
    
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
      const [dbMeals, userBaseline, streaks, checkInData, recentCheckIns, waterData, monthlyFocusPoints, dailyFocusPoints] = await Promise.all([
        getTodaysMeals(),
        getUserBaseline(),
        getStreaks(),
        getTodaysCheckIn(),
        getRecentCheckIns(7),
        getTodaysWaterIntake(),
        getActiveCoachingFocusPoints(),
        getTodaysDailyFocusPoints(),
      ]);
      
      setCustomFocusPoints(monthlyFocusPoints);
      
      if (dailyFocusPoints && dailyFocusPoints.length > 0) {
        setDailyCheckInFocusPoints(dailyFocusPoints);
      }
      
      setHasCheckedInToday(!!checkInData);
      setTodaysCheckIn(checkInData);
      setTotalWaterMl(waterData.reduce((sum, w) => sum + w.amount_ml, 0));
      
      setBaseline(userBaseline);
      if (userBaseline) {
        setAccountAgeDays(getAccountAgeDays(userBaseline));
        
        analyzeMealPatterns(userBaseline).then(patterns => {
          setMealPatterns(patterns);
        });
      }
      
      if (recentCheckIns.length > 0) {
        const userTargets: UserTargets = {
          targetCalories: userBaseline?.target_calories || undefined,
          proteinGrams: userBaseline?.protein_grams || undefined,
          carbsGrams: userBaseline?.carbs_grams || undefined,
          fatsGrams: userBaseline?.fats_grams || undefined,
          waterLiters: userBaseline?.water_liters || undefined,
          sleepHours: userBaseline?.sleep_hours || undefined,
        };
        setCheckInAnalysis(analyzeCheckIns(recentCheckIns, userTargets));
      }
      
      const formattedMeals: DashboardMeal[] = dbMeals.map(meal => ({
        id: meal.id,
        name: meal.name,
        time: new Date(meal.logged_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fats: meal.fats,
        imageUrl: meal.image_url || undefined,
      }));
      setMeals(formattedMeals);
      
      const loginStreakData = streaks.find(s => s.streak_type === 'login');
      const coachingStreakData = streaks.find(s => s.streak_type === 'coaching');
      setLoginStreak(loginStreakData || null);
      setCoachingStreak(coachingStreakData || null);
      
      const updatedLoginStreak = await updateStreak('login');
      if (updatedLoginStreak) {
        setLoginStreak(updatedLoginStreak);
        if (updatedLoginStreak.current_streak > (loginStreakData?.current_streak || 0) && 
            updatedLoginStreak.current_streak >= 3) {
          setShowStreakCelebration(true);
        }
      }
      
      if (userBaseline) {
        const recalResult = await checkRecalibrationNeeded(userBaseline);
        if (recalResult.shouldRecalibrate) {
          setRecalibrationResult(recalResult);
          setShowRecalibration(true);
        }
        
        if (checkProgressUpdateNeeded(userBaseline)) {
          setTimeout(() => setShowProgressUpdate(true), 2000);
        }
      }
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCoachingFocusPoints = async () => {
    try {
      const [monthlyFocusPoints, dailyFocusPoints] = await Promise.all([
        getActiveCoachingFocusPoints(),
        getTodaysDailyFocusPoints(),
      ]);
      setCustomFocusPoints(monthlyFocusPoints);
      if (dailyFocusPoints && dailyFocusPoints.length > 0) {
        setDailyCheckInFocusPoints(dailyFocusPoints);
      }
    } catch (error) {
      console.error("Error refreshing coaching focus points:", error);
    }
  };

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
        
        const newTotalCalories = updatedMeals.reduce((sum, m) => sum + m.calories, 0);
        const newTotalProtein = updatedMeals.reduce((sum, m) => sum + m.protein, 0);
        const newTotalCarbs = updatedMeals.reduce((sum, m) => sum + m.carbs, 0);
        const newTotalFats = updatedMeals.reduce((sum, m) => sum + m.fats, 0);
        
        const calorieGoal = baseline?.target_calories || 2000;
        const proteinGoal = baseline?.protein_grams || 120;
        const carbsGoal = baseline?.carbs_grams || 200;
        const fatsGoal = baseline?.fats_grams || 65;
        
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
        
        toast.success(getMealEncouragement());
        refreshCoachingFocusPoints();
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

  const layout = baseline?.dashboard_layout || DEFAULT_LAYOUT;
  const visibleSections = layout.sections.filter(s => !layout.hidden.includes(s));

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
          onClick={() => navigate("/meals")}
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
        
        <button
          onClick={() => setShowInstagramImport(true)}
          className="w-full p-3 rounded-xl border border-dashed border-pink-500/30 bg-gradient-to-r from-pink-500/5 to-purple-500/5 flex items-center justify-center gap-2 hover:border-pink-500/50 hover:from-pink-500/10 hover:to-purple-500/10 transition-all"
        >
          <Instagram className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium text-pink-500">Import Instagram Recipe</span>
        </button>
        
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
        customFocusPoints={customFocusPoints}
        dailyCheckInFocusPoints={dailyCheckInFocusPoints}
      />
    </section>
  );


  const renderWaterSection = () => (
    <section key="water">
      <WaterTracker 
        dailyGoalLiters={baseline?.water_liters || 2.5} 
        onWaterLogged={refreshCoachingFocusPoints}
      />
    </section>
  );

  const sectionRenderers: Record<string, () => JSX.Element> = {
    progress: renderProgressSection,
    meals: renderMealsSection,
    coach: renderCoachSection,
    water: renderWaterSection,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50 safe-pt-4">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">{getGreeting()},</p>
            <h1 className="text-xl font-bold text-foreground">
              {baseline?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAIChat(true)}
              className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors flex items-center gap-1.5"
              aria-label="Open Coach Mac"
            >
              <span className="text-sm font-semibold text-primary">Coach Mac</span>
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
                loadData();
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
          currentDayTotals={{
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fats: totalFats,
          }}
          dailyTargets={{
            calories: baseline?.target_calories || 2000,
            protein: baseline?.protein_grams || 120,
            carbs: baseline?.carbs_grams || 250,
            fats: baseline?.fats_grams || 65,
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
          onDailyFocusPointsReceived={(focusPoints) => {
            setDailyCheckInFocusPoints(focusPoints);
          }}
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
            setFreshCheckInData(checkInData);
            setShowAIChat(true);
            updateStreak('coaching').then(streak => {
              if (streak) setCoachingStreak(streak);
            });
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

      {/* Progress Update Dialog */}
      <ProgressUpdateDialog
        open={showProgressUpdate}
        onOpenChange={setShowProgressUpdate}
        baseline={baseline}
        onComplete={loadData}
      />

      {/* Instagram Recipe Import Dialog */}
      <InstagramRecipeImport
        open={showInstagramImport}
        onOpenChange={setShowInstagramImport}
        onMealLogged={loadData}
        initialUrl={sharedUrl}
        onInitialUrlProcessed={clearSharedUrl}
      />
    </div>
  );
};
