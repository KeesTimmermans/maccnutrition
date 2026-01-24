import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, Bot, User, Loader2, Moon, Battery, Brain, Smile, TrendingUp, TrendingDown, Minus, Heart, Watch, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTodaysMeals, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getRecentCheckIns, analyzeCheckIns, formatCheckInsForAI, buildTemporalCheckInContext, type DailyCheckIn, type CheckInAnalysis } from "@/lib/checkinService";
import { getTodaysWearableData, getRecentWearableData, formatWearableDataForAI, type WearableSummary } from "@/lib/wearableService";
import { loadWeeklyConversation, saveWeeklyConversation, clearWeeklyConversation, type ChatMessage } from "@/lib/coachConversationService";
import { useLanguage, Language } from "@/lib/i18n";
import { toast } from "sonner";

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
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save conversation whenever messages change (debounced)
  const saveConversation = useCallback(async (msgs: Message[]) => {
    if (msgs.length === 0) return;
    try {
      const chatMessages: ChatMessage[] = msgs.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }));
      await saveWeeklyConversation(chatMessages);
    } catch (error) {
      console.error("Error saving conversation:", error);
    }
  }, []);

  useEffect(() => {
    initializeChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages when they change (after initial load)
  useEffect(() => {
    if (hasLoadedHistory && messages.length > 0) {
      saveConversation(messages);
    }
  }, [messages, hasLoadedHistory, saveConversation]);

  const initializeChat = async () => {
    try {
      const [userBaseline, meals, recentCheckIns, wearableSummary, recentWearable, savedConversation] = await Promise.all([
        getUserBaseline(),
        getTodaysMeals(),
        getRecentCheckIns(7),
        getTodaysWearableData(),
        getRecentWearableData(7),
        loadWeeklyConversation(),
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

      // If we have saved conversation, load it; otherwise generate greeting
      if (savedConversation.length > 0 && !freshCheckIn) {
        // Load existing conversation
        const loadedMessages: Message[] = savedConversation.map(m => ({
          role: m.role,
          content: m.content,
        }));
        setMessages(loadedMessages);
        setHasLoadedHistory(true);
      } else {
        // Generate fresh greeting
        let greeting = "";
        
        // If fresh check-in was just submitted, acknowledge it naturally like a human coach
        if (freshCheckIn) {
          const moodEmoji = EMOJI_SCALE[freshCheckIn.mood - 1] || '😐';
          
          // Build a natural, conversational response
          const parts: string[] = [];
          
          // Opening based on how they're feeling
          if (freshCheckIn.mood <= 2 && freshCheckIn.energy_level <= 2) {
            parts.push("Hey, sounds like you're having a rough one.");
          } else if (freshCheckIn.mood >= 4 && freshCheckIn.energy_level >= 4) {
            parts.push(`${moodEmoji} Nice — you're feeling good today!`);
          } else {
            parts.push(`Got it, thanks for checking in ${moodEmoji}`);
          }
          
          // Address the most pressing issue naturally
          if (freshCheckIn.sleep_quality <= 2 && freshCheckIn.energy_level <= 2) {
            parts.push("Sleep was rough and energy's tanked — that's a tough combo. Let's focus on foods that won't make it worse: complex carbs, some protein, and definitely stay hydrated.");
          } else if (freshCheckIn.stress_level >= 4) {
            parts.push("Stress is really up there. When you're this wound up, don't worry about optimizing — just make sure you're eating something decent and not skipping meals.");
          } else if (freshCheckIn.energy_level <= 2) {
            parts.push("Energy's dragging. Are you eating enough? Sometimes we just need more fuel. Try adding some protein and complex carbs to your next meal.");
          } else if (freshCheckIn.sleep_quality <= 2) {
            parts.push("Sleep wasn't great — that always makes everything harder. Consider magnesium-rich foods and maybe ease up on caffeine after noon.");
          } else if (freshCheckIn.mood <= 2) {
            parts.push("Mood's low, which happens. Food won't fix everything, but stable blood sugar helps — try to avoid big sugar spikes today.");
          }
          
          // Add hunger context if relevant
          if (freshCheckIn.hunger_level && freshCheckIn.hunger_level >= 4) {
            parts.push("You mentioned feeling hungry — make sure you're getting enough protein and fiber to stay full.");
          }
          
          parts.push("\nWhat's on your mind?");
          greeting = parts.join(" ");
        } else {
          const firstName = userBaseline?.name?.split(' ')[0] || '';
          const greetParts: string[] = [];
          
          // Natural opening
          greetParts.push(`Hey${firstName ? ` ${firstName}` : ''}!`);
          
          // Reference wearable data naturally if available
          if (wearableSummary) {
            if (wearableSummary.sleepHours && wearableSummary.sleepHours < 6) {
              greetParts.push(`Your ${wearableSummary.provider} says only ${wearableSummary.sleepHours}h of sleep — that's rough.`);
            } else if (wearableSummary.recoveryScore && wearableSummary.recoveryScore <= 2) {
              greetParts.push(`Recovery looks low today according to your ${wearableSummary.provider} — might want to take it easy.`);
            }
          }
          
          // Reference today's check-in naturally
          if (todayCheck) {
            const temporal = buildTemporalCheckInContext(recentCheckIns);
            
            // Reference day-over-day changes
            if (temporal.changes.energyChange === 'worse') {
              greetParts.push("Energy dipped from yesterday — what's going on?");
            } else if (temporal.changes.energyChange === 'better') {
              greetParts.push("Energy's bouncing back from yesterday — nice.");
            } else if (todayCheck.energy_level <= 2) {
              greetParts.push("Looks like you're running on empty today.");
            } else if (todayCheck.energy_level >= 4) {
              greetParts.push("Good energy today!");
            }
            
            if (todayCheck.stress_level >= 4 && temporal.patterns.consistentlyHighStress) {
              greetParts.push("Stress has been high for a few days — we should talk about that.");
            }
          }

          // Meal progress mention
          if (meals.length > 0) {
            const totalCals = meals.reduce((s, m) => s + m.calories, 0);
            const targetCals = userBaseline?.target_calories || 2000;
            const percent = Math.round((totalCals / targetCals) * 100);
            if (percent >= 80) {
              greetParts.push(`You're at ${percent}% of calories — almost there.`);
            } else if (percent < 50 && new Date().getHours() > 15) {
              greetParts.push(`Only ${percent}% of calories so far and it's getting late — make sure to eat.`);
            }
          }

          greetParts.push("\nWhat can I help with?");
          greeting = greetParts.join(" ");
        }

        setMessages([{ role: "assistant", content: greeting }]);
        setHasLoadedHistory(true);
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
      setMessages([{
        role: "assistant",
        content: "Hey! I'm Coach Mac. What can I help with today?"
      }]);
      setHasLoadedHistory(true);
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
            // User's name
            userName: baseline.name,
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
            // Eating behavior
            eatingSpeed: baseline.eating_speed,
            hungerPatterns: baseline.hunger_patterns,
            cravingsTriggers: baseline.cravings_triggers,
            emotionalEating: baseline.emotional_eating,
            snackingHabits: baseline.snacking_habits,
            hydrationHabits: baseline.hydration_habits,
            energyPatterns: baseline.energy_patterns,
            // Challenges & history
            biggestChallenge: baseline.biggest_challenge,
            pastDiets: baseline.past_diets,
            weekendHabits: baseline.weekend_habits,
            eatingOutFrequency: baseline.eating_out_frequency,
            // Motivation
            motivationStyle: baseline.motivation_style,
            accountabilityPreference: baseline.accountability_preference,
            // Preferences
            dietType: baseline.diet_type,
            foodDislikes: baseline.food_dislikes,
            allergies: baseline.allergies,
            conditions: baseline.conditions,
            coachingTone: baseline.coaching_tone,
            focusPoints: baseline.focus_points,
            mealsPerDay: baseline.meals_per_day,
            mealPrepTime: baseline.meal_prep_time,
            cookingSkill: baseline.cooking_skill,
            proteinShakesPreference: baseline.protein_shakes_preference,
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

  const handleClearConversation = async () => {
    try {
      await clearWeeklyConversation();
      setMessages([{
        role: "assistant",
        content: "Hey! Fresh start. What can I help with?"
      }]);
      toast.success("Conversation cleared");
    } catch (error) {
      console.error("Error clearing conversation:", error);
      toast.error("Failed to clear conversation");
    }
  };

  const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
    if (trend === "improving") return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (trend === "declining") return <TrendingDown className="w-3 h-3 text-destructive" />;
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
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button 
              onClick={handleClearConversation} 
              className="p-2 hover:bg-muted rounded-xl transition-colors"
              title="Start fresh conversation"
            >
              <RotateCcw className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="w-6 h-6 text-foreground" />
          </button>
        </div>
      </div>

      {/* Check-In Summary Card - only show when there's actual data */}
      {(todaysCheckIn || (checkInAnalysis && checkInAnalysis.averageMood > 0)) && (
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
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">No check-in today. 7-day averages:</p>
                <div className="flex justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Smile className="w-3 h-3" /> {checkInAnalysis!.averageMood}/5
                    {getTrendIcon(checkInAnalysis!.trends.mood)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Battery className="w-3 h-3" /> {checkInAnalysis!.averageEnergy}/5
                    {getTrendIcon(checkInAnalysis!.trends.energy)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Moon className="w-3 h-3" /> {checkInAnalysis!.averageSleep}/5
                    {getTrendIcon(checkInAnalysis!.trends.sleep)}
                  </span>
                </div>
              </div>
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
