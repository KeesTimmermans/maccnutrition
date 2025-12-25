import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { MealCard, AddMealCard } from "@/components/MealCard";
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
import { Bell, Flame, TrendingUp, Sun, Watch } from "lucide-react";
import { saveMeal, getTodaysMeals, updateMeal, deleteMeal, MealInput, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getStreaks, updateStreak, UserStreak } from "@/lib/streakService";
import { getTodaysCheckIn, getRecentCheckIns, analyzeCheckIns, CheckInAnalysis, UserTargets } from "@/lib/checkinService";
import { getTodaysWearableData, getWearableConnections, type WearableSummary } from "@/lib/wearableService";
import { checkRecalibrationNeeded, RecalibrationResult } from "@/lib/baselineRecalibration";
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
  const [showWearableSettings, setShowWearableSettings] = useState(false);
  const [wearableData, setWearableData] = useState<WearableSummary | null>(null);
  const [hasWearableConnections, setHasWearableConnections] = useState(false);
  const [checkInAnalysis, setCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [recalibrationResult, setRecalibrationResult] = useState<RecalibrationResult | null>(null);
  const [showRecalibration, setShowRecalibration] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dbMeals, userBaseline, streaks, todaysCheckIn, wearable, wearableConns, recentCheckIns] = await Promise.all([
        getTodaysMeals(),
        getUserBaseline(),
        getStreaks(),
        getTodaysCheckIn(),
        getTodaysWearableData(),
        getWearableConnections(),
        getRecentCheckIns(7),
      ]);
      
      setHasCheckedInToday(!!todaysCheckIn);
      setWearableData(wearable);
      setHasWearableConnections(wearableConns.length > 0);
      
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
      setBaseline(userBaseline);
      
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">{getGreeting()},</p>
            <h1 className="text-xl font-bold text-foreground">Sarah! 👋</h1>
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

        {/* Streak Card */}
        <section>
          <StreakCard loginStreak={loginStreak} coachingStreak={coachingStreak} />
        </section>

        {/* AI Coach */}
        <section>
          <AICoachCard 
            greeting={checkInAnalysis && checkInAnalysis.recommendations.length > 0 
              ? `Based on your recent check-ins (avg mood: ${checkInAnalysis.averageMood}/5, energy: ${checkInAnalysis.averageEnergy}/5):`
              : `${getGreeting()}! ${t('complete_checkin_insight')}`}
            insights={checkInAnalysis?.recommendations.length ? checkInAnalysis.recommendations : [t('complete_checkin_insight')]}
            tip={checkInAnalysis?.trends.energy === "declining" 
              ? "Your energy has been declining. Consider adding more protein and complex carbs to your meals."
              : checkInAnalysis?.trends.sleep === "declining"
              ? "Sleep quality is trending down. Try magnesium-rich foods in your evening meals."
              : "Stay consistent with your meals and hydration for best results!"}
            onChatOpen={() => {
              setShowAIChat(true);
              updateStreak('coaching').then(streak => {
                if (streak) setCoachingStreak(streak);
              });
            }}
          />
        </section>

        {/* Daily Summary Card */}
        <section className="bg-card rounded-3xl shadow-medium p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">{t('todays_progress')}</h2>
              <p className="text-sm text-muted-foreground">{t('keep_up_great_work')}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-full">
              <Flame className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-secondary">
                {loginStreak?.current_streak || 0} {t('day_streak')}
              </span>
            </div>
          </div>

          {/* Macro Rings */}
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

        {/* Meals Section */}
        <section>
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
                  <MealCard 
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

        {/* Water Tracker */}
        <section>
          <WaterTracker dailyGoalLiters={baseline?.water_liters || 2.5} />
        </section>

        {/* Wearable Data Card */}
        <section>
          <button 
            onClick={() => setShowWearableSettings(true)}
            className="w-full bg-card rounded-2xl shadow-soft p-4 flex items-center gap-4 hover:shadow-medium transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Watch className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{t('wearable_devices')}</h3>
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

        {/* Meal Planner */}
        <section>
          <MealPlanner baseline={baseline} />
        </section>
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
            // Immediately open AI chat with fresh check-in data
            setFreshCheckInData(checkInData);
            setShowAIChat(true);
            // Update coaching streak
            updateStreak('coaching').then(streak => {
              if (streak) setCoachingStreak(streak);
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
