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
import { Bell, Flame, TrendingUp } from "lucide-react";
import { saveMeal, getTodaysMeals, updateMeal, deleteMeal, MealInput, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getStreaks, updateStreak, UserStreak } from "@/lib/streakService";
import { toast } from "sonner";

const mockInsights = [
  "You're 82% to your protein goal! Great job prioritizing lean proteins today.",
  "Your carb intake is balanced. Consider adding more fiber-rich vegetables with dinner.",
];

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
  const [showMealLogger, setShowMealLogger] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [meals, setMeals] = useState<DashboardMeal[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [loginStreak, setLoginStreak] = useState<UserStreak | null>(null);
  const [coachingStreak, setCoachingStreak] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dbMeals, userBaseline, streaks] = await Promise.all([
        getTodaysMeals(),
        getUserBaseline(),
        getStreaks(),
      ]);
      
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
        setMeals(prev => [...prev, newMeal]);
        toast.success("Meal logged successfully!");
      }
    } catch (error) {
      console.error("Error saving meal:", error);
      toast.error("Failed to save meal. Please try again.");
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
      toast.success("Meal updated!");
    } catch (error) {
      console.error("Error updating meal:", error);
      toast.error("Failed to update meal.");
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    try {
      await deleteMeal(mealId);
      setMeals(prev => prev.filter(m => m.id !== mealId));
      toast.success("Meal deleted");
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast.error("Failed to delete meal.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">Good morning,</p>
            <h1 className="text-xl font-bold text-foreground">Sarah! 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-muted rounded-xl transition-colors relative">
              <Bell className="w-6 h-6 text-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full" />
            </button>
            <SettingsSheet baseline={baseline} onSettingsChange={loadData} />
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Streak Card */}
        <section>
          <StreakCard loginStreak={loginStreak} coachingStreak={coachingStreak} />
        </section>

        {/* AI Coach */}
        <section>
          <AICoachCard 
            greeting="Good morning! You're making excellent progress today."
            insights={mockInsights}
            tip="Try adding avocado to your next meal - it's a great source of healthy fats and will help you reach your daily target!"
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
              <h2 className="text-lg font-bold text-foreground">Today's Progress</h2>
              <p className="text-sm text-muted-foreground">Keep up the great work!</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-full">
              <Flame className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-secondary">
                {loginStreak?.current_streak || 0} day streak
              </span>
            </div>
          </div>

          {/* Macro Rings */}
          <div className="flex justify-around items-center">
            <MacroRing 
              value={totalCalories} 
              max={baseline?.target_calories || 2000} 
              label="Calories" 
              color="calories"
              size="lg"
              unit=""
            />
            <div className="space-y-4">
              <MacroRing 
                value={totalProtein} 
                max={baseline?.protein_grams || 120} 
                label="Protein" 
                color="protein"
                size="sm"
              />
              <MacroRing 
                value={totalCarbs} 
                max={baseline?.carbs_grams || 200} 
                label="Carbs" 
                color="carbs"
                size="sm"
              />
              <MacroRing 
                value={totalFats} 
                max={baseline?.fats_grams || 65} 
                label="Fats" 
                color="fats"
                size="sm"
              />
            </div>
          </div>
        </section>

        {/* Meals Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Today's Meals</h2>
            <button 
              onClick={() => navigate("/history")}
              className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
            >
              View all
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading meals...</div>
            ) : meals.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No meals logged yet today. Add your first meal!
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

        {/* Meal Planner */}
        <section>
          <MealPlanner baseline={baseline} />
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="container flex justify-around py-3">
          {[
            { icon: "🏠", label: "Home", path: "/", active: true },
            { icon: "📊", label: "Progress", path: "/progress", active: false },
            { icon: "🍽️", label: "Meals", path: "/history", active: false },
            { icon: "👤", label: "Profile", path: "/", active: false },
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
        <AICoachChat onClose={() => setShowAIChat(false)} />
      )}

      {/* Streak Celebration */}
      {showStreakCelebration && (
        <StreakCelebration 
          streak={loginStreak} 
          onClose={() => setShowStreakCelebration(false)} 
        />
      )}
    </div>
  );
};
