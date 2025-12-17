import { useState } from "react";
import { MacroRing } from "@/components/MacroRing";
import { MealCard, AddMealCard } from "@/components/MealCard";
import { AICoachCard } from "@/components/AICoachCard";
import { MealLogger } from "@/components/MealLogger";
import { Bell, Settings, Flame, TrendingUp } from "lucide-react";

// Mock data
const mockMeals = [
  {
    id: "1",
    name: "Greek Yogurt Bowl",
    time: "8:30 AM",
    calories: 320,
    protein: 22,
    carbs: 35,
    fats: 8,
  },
  {
    id: "2",
    name: "Grilled Chicken Wrap",
    time: "12:45 PM",
    calories: 520,
    protein: 38,
    carbs: 42,
    fats: 18,
  },
];

const mockInsights = [
  "You're 82% to your protein goal! Great job prioritizing lean proteins today.",
  "Your carb intake is balanced. Consider adding more fiber-rich vegetables with dinner.",
];

export const Dashboard = () => {
  const [showMealLogger, setShowMealLogger] = useState(false);
  const [meals, setMeals] = useState(mockMeals);

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbs, 0);
  const totalFats = meals.reduce((sum, m) => sum + m.fats, 0);

  const handleAddMeal = (meal: {
    name: string;
    imageUrl?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => {
    const newMeal = {
      id: Date.now().toString(),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      ...meal,
    };
    setMeals(prev => [...prev, newMeal]);
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
            <button className="p-2 hover:bg-muted rounded-xl transition-colors">
              <Settings className="w-6 h-6 text-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Daily Summary Card */}
        <section className="bg-card rounded-3xl shadow-medium p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Today's Progress</h2>
              <p className="text-sm text-muted-foreground">Keep up the great work!</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/10 rounded-full">
              <Flame className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-secondary">7 day streak</span>
            </div>
          </div>

          {/* Macro Rings */}
          <div className="flex justify-around items-center">
            <MacroRing 
              value={totalCalories} 
              max={2000} 
              label="Calories" 
              color="calories"
              size="lg"
              unit=""
            />
            <div className="space-y-4">
              <MacroRing 
                value={totalProtein} 
                max={120} 
                label="Protein" 
                color="protein"
                size="sm"
              />
              <MacroRing 
                value={totalCarbs} 
                max={200} 
                label="Carbs" 
                color="carbs"
                size="sm"
              />
              <MacroRing 
                value={totalFats} 
                max={65} 
                label="Fats" 
                color="fats"
                size="sm"
              />
            </div>
          </div>
        </section>

        {/* AI Coach */}
        <section>
          <AICoachCard 
            greeting="Good morning! You're making excellent progress today."
            insights={mockInsights}
            tip="Try adding avocado to your next meal - it's a great source of healthy fats and will help you reach your daily target!"
          />
        </section>

        {/* Meals Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Today's Meals</h2>
            <button className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline">
              View all
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            {meals.map((meal, index) => (
              <div key={meal.id} style={{ animationDelay: `${index * 100}ms` }}>
                <MealCard meal={meal} />
              </div>
            ))}
            <AddMealCard onClick={() => setShowMealLogger(true)} />
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-border/50 z-50">
        <div className="container flex justify-around py-3">
          {[
            { icon: "🏠", label: "Home", active: true },
            { icon: "📊", label: "Progress", active: false },
            { icon: "🍽️", label: "Meals", active: false },
            { icon: "👤", label: "Profile", active: false },
          ].map((item) => (
            <button
              key={item.label}
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
    </div>
  );
};
