import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, Bot, User, Loader2, Moon, Battery, Brain, Smile, TrendingUp, TrendingDown, Minus, Heart, Watch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTodaysMeals, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getRecentCheckIns, analyzeCheckIns, formatCheckInsForAI, type DailyCheckIn, type CheckInAnalysis } from "@/lib/checkinService";
import { getTodaysWearableData, getRecentWearableData, formatWearableDataForAI, type WearableSummary } from "@/lib/wearableService";
import { useLanguage, Language } from "@/lib/i18n";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICoachChatProps {
  onClose: () => void;
  freshCheckIn?: DailyCheckIn | null;
}

const EMOJI_SCALE = ['😫', '😕', '😐', '🙂', '😊'];

export const AICoachChat = ({ onClose, freshCheckIn }: AICoachChatProps) => {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [todaysCheckIn, setTodaysCheckIn] = useState<DailyCheckIn | null>(null);
  const [checkInAnalysis, setCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [todaysMeals, setTodaysMeals] = useState<Meal[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [wearableData, setWearableData] = useState<WearableSummary | null>(null);
  const [wearableContext, setWearableContext] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeChat = async () => {
    try {
      const [userBaseline, meals, recentCheckIns, wearableSummary, recentWearable] = await Promise.all([
        getUserBaseline(),
        getTodaysMeals(),
        getRecentCheckIns(7),
        getTodaysWearableData(),
        getRecentWearableData(7)
      ]);

      setBaseline(userBaseline);
      setTodaysMeals(meals);
      setWearableData(wearableSummary);

      // Build wearable context for AI
      const wearableCtx = formatWearableDataForAI(wearableSummary, recentWearable);
      setWearableContext(wearableCtx);

      const today = new Date().toISOString().split('T')[0];
      // Prefer freshCheckIn if provided (just completed), otherwise find from recent
      const todayCheck = freshCheckIn || recentCheckIns.find(c => c.check_in_date === today);
      setTodaysCheckIn(todayCheck || null);

      const analysis = analyzeCheckIns(recentCheckIns);
      setCheckInAnalysis(analysis);

      // Generate personalized greeting based on data
      let greeting = "";
      
      // If fresh check-in was just submitted, acknowledge it immediately
      if (freshCheckIn) {
        const moodEmoji = EMOJI_SCALE[freshCheckIn.mood - 1] || '😐';
        greeting = `Thanks for checking in! ${moodEmoji} I've received your update:\n\n`;
        greeting += `• Mood: ${freshCheckIn.mood}/5\n`;
        greeting += `• Energy: ${freshCheckIn.energy_level}/5\n`;
        greeting += `• Sleep quality: ${freshCheckIn.sleep_quality}/5`;
        if (freshCheckIn.sleep_hours) {
          greeting += ` (${freshCheckIn.sleep_hours}h)`;
        }
        greeting += `\n• Stress: ${freshCheckIn.stress_level}/5\n\n`;
        
        // Personalized recommendations based on check-in
        if (freshCheckIn.energy_level <= 2) {
          greeting += "Your energy is low today. I'll suggest meals rich in complex carbs and B vitamins to help boost it. ";
        } else if (freshCheckIn.energy_level >= 4) {
          greeting += "Great energy today! Let's keep that momentum going. ";
        }
        
        if (freshCheckIn.sleep_quality <= 2) {
          greeting += "Since sleep was rough, I recommend magnesium-rich foods and avoiding caffeine after 2pm. ";
        }
        
        if (freshCheckIn.stress_level >= 4) {
          greeting += "I notice stress is high — foods with omega-3s and antioxidants can help. Avoid excess sugar. ";
        }
        
        if (freshCheckIn.hunger_level && freshCheckIn.hunger_level >= 4) {
          greeting += "You're feeling quite hungry — make sure to include enough protein and fiber to stay satisfied. ";
        }
        
        greeting += "\n\nHow can I help you today?";
      } else {
        greeting = "Hi! I'm Coach Mac, your personal nutrition guide. ";
        
        // Include wearable data in greeting
        if (wearableSummary) {
          greeting += `I see your ${wearableSummary.provider} data: `;
          if (wearableSummary.sleepHours) {
            greeting += `${wearableSummary.sleepHours}h sleep`;
            if (wearableSummary.sleepHours < 6) greeting += " (low) ";
          }
          if (wearableSummary.recoveryScore) {
            greeting += `, recovery ${wearableSummary.recoveryScore}/5`;
          }
          if (wearableSummary.hrv) {
            greeting += `, HRV ${wearableSummary.hrv}ms`;
          }
          greeting += ". ";
        }
        
        if (todayCheck) {
          const moodEmoji = EMOJI_SCALE[todayCheck.mood - 1] || '😐';
          greeting += `Check-in today ${moodEmoji}. `;
          
          if (todayCheck.energy_level <= 2) {
            greeting += "Looks like energy is low — let's focus on foods that can help boost it. ";
          } else if (todayCheck.energy_level >= 4) {
            greeting += "Great energy today! ";
          }
          
          if (todayCheck.sleep_quality <= 2) {
            greeting += "Sleep was rough — I'll factor that into my suggestions. ";
          }
          
          if (todayCheck.stress_level >= 4) {
            greeting += "I notice stress is high — I'll recommend foods that support calm and steady energy. ";
          }
        }

        if (meals.length > 0) {
          const totalCals = meals.reduce((s, m) => s + m.calories, 0);
          const targetCals = userBaseline?.target_calories || 2000;
          const percent = Math.round((totalCals / targetCals) * 100);
          greeting += `You're at ${percent}% of your calorie target so far. `;
        }

        greeting += "Ask me anything about nutrition, meal suggestions, or how you're tracking!";
      }

      setMessages([{ role: "assistant", content: greeting }]);
    } catch (error) {
      console.error("Error initializing chat:", error);
      setMessages([{
        role: "assistant",
        content: "Hi! I'm Coach Mac, your personal nutrition guide. Ask me anything about nutrition, meal suggestions, or how you're tracking today!"
      }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Refresh check-in data
      const recentCheckIns = await getRecentCheckIns(7);
      const analysis = analyzeCheckIns(recentCheckIns);
      const checkInContext = formatCheckInsForAI(recentCheckIns, analysis);

      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          messages: newMessages,
          userContext: baseline ? {
            // Core profile
            primaryGoal: baseline.primary_goal,
            secondaryGoals: baseline.secondary_goals,
            sex: baseline.sex,
            age: baseline.age,
            // Nutrition targets
            targetCalories: baseline.target_calories,
            proteinGrams: baseline.protein_grams,
            carbsGrams: baseline.carbs_grams,
            fatsGrams: baseline.fats_grams,
            waterLiters: baseline.water_liters,
            // Lifestyle
            activityLevel: baseline.activity_level,
            trainingDays: baseline.training_days,
            trainingIntensity: baseline.training_intensity,
            sleepHours: baseline.sleep_hours,
            stressLevel: baseline.stress_level,
            occupation: baseline.occupation,
            // Preferences
            dietType: baseline.diet_type,
            foodDislikes: baseline.food_dislikes,
            allergies: baseline.allergies,
            conditions: baseline.conditions,
            coachingTone: baseline.coaching_tone,
            focusPoints: baseline.focus_points,
            // Female-specific
            currentPhase: baseline.current_phase,
            cycleRegularity: baseline.cycle_regularity,
            cycleSymptoms: baseline.cycle_symptoms,
            // Check-in data
            checkInContext: checkInContext,
            checkInAnalysis: analysis.recommendations.length > 0 ? analysis : null,
            // Wearable data
            wearableContext: wearableContext,
            // Language preference
            preferredLanguage: language as Language,
          } : {},
          todaysMeals: todaysMeals.map(m => ({
            name: m.name,
            calories: m.calories,
            protein: m.protein,
            carbs: m.carbs,
            fats: m.fats
          }))
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I had trouble responding. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
    if (trend === "improving") return <TrendingUp className="w-3 h-3 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Coach Mac</h2>
            <p className="text-xs text-muted-foreground">Your nutrition coach</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Check-In Summary Card */}
      {(todaysCheckIn || checkInAnalysis) && (
        <div className="px-4 pt-4">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-4">
            <h3 className="text-xs font-semibold text-primary mb-3 uppercase tracking-wide">Today's Status</h3>
            
            {todaysCheckIn ? (
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-xl mb-1">{EMOJI_SCALE[todaysCheckIn.mood - 1]}</div>
                  <p className="text-xs text-muted-foreground">Mood</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Battery className={`w-4 h-4 ${todaysCheckIn.energy_level >= 3 ? 'text-green-500' : 'text-orange-500'}`} />
                    <span className="text-sm font-semibold">{todaysCheckIn.energy_level}/5</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Energy</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Moon className={`w-4 h-4 ${todaysCheckIn.sleep_quality >= 3 ? 'text-blue-500' : 'text-orange-500'}`} />
                    <span className="text-sm font-semibold">{todaysCheckIn.sleep_quality}/5</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Sleep</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Brain className={`w-4 h-4 ${todaysCheckIn.stress_level <= 3 ? 'text-purple-500' : 'text-orange-500'}`} />
                    <span className="text-sm font-semibold">{todaysCheckIn.stress_level}/5</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Stress</p>
                </div>
              </div>
            ) : checkInAnalysis && checkInAnalysis.averageMood > 0 ? (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">No check-in today. 7-day averages:</p>
                <div className="flex justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Smile className="w-3 h-3" /> {checkInAnalysis.averageMood}/5
                    {getTrendIcon(checkInAnalysis.trends.mood)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Battery className="w-3 h-3" /> {checkInAnalysis.averageEnergy}/5
                    {getTrendIcon(checkInAnalysis.trends.energy)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="w-3 h-3" /> {checkInAnalysis.averageSleep}/5
                    {getTrendIcon(checkInAnalysis.trends.sleep)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground">
                Complete a daily check-in to see your status here
              </p>
            )}

            {/* Pattern-based insight */}
            {checkInAnalysis && checkInAnalysis.recommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-primary/10">
                <p className="text-xs text-primary font-medium">💡 {checkInAnalysis.recommendations[0]}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "user" 
                ? "bg-primary" 
                : "gradient-hero"
            }`}>
              {msg.role === "user" 
                ? <User className="w-4 h-4 text-primary-foreground" />
                : <Bot className="w-4 h-4 text-primary-foreground" />
              }
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted text-foreground rounded-tl-sm"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full gradient-hero flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {[
              "How am I tracking today?",
              todaysCheckIn?.energy_level && todaysCheckIn.energy_level <= 2 
                ? "What can I eat to boost energy?" 
                : "What should I eat for dinner?",
              todaysCheckIn?.sleep_quality && todaysCheckIn.sleep_quality <= 2
                ? "Foods to help me sleep better?"
                : "How can I hit my protein goal?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-full text-foreground transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 rounded-xl"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
