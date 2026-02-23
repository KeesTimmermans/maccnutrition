import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SafeAreaContainer } from "@/components/layout/SafeAreaContainer";
import { X, Send, Bot, User, Loader2, Moon, Battery, Brain, Smile, TrendingUp, TrendingDown, Minus, Heart, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTodaysMeals, Meal } from "@/lib/mealService";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { getRecentCheckIns, analyzeCheckIns, formatCheckInsForAI, buildTemporalCheckInContext, saveDailyFocusPoints, type DailyCheckIn, type CheckInAnalysis } from "@/lib/checkinService";

import { loadWeeklyConversation, saveWeeklyConversation, clearWeeklyConversation, type ChatMessage } from "@/lib/coachConversationService";
import { parseDailyFocusPoints, type CoachingFocusPoint } from "@/lib/progressUpdateService";
import { useLanguage, Language } from "@/lib/i18n";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICoachChatProps {
  onClose: () => void;
  freshCheckIn?: DailyCheckIn | null;
  onDailyFocusPointsReceived?: (focusPoints: CoachingFocusPoint[]) => void;
}

const EMOJI_SCALE = ['😫', '😕', '😐', '🙂', '😊'];

export const AICoachChat = ({ onClose, freshCheckIn, onDailyFocusPointsReceived }: AICoachChatProps) => {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [todaysCheckIn, setTodaysCheckIn] = useState<DailyCheckIn | null>(null);
  const [checkInAnalysis, setCheckInAnalysis] = useState<CheckInAnalysis | null>(null);
  const [todaysMeals, setTodaysMeals] = useState<Meal[]>([]);
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
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
      const [userBaseline, meals, recentCheckIns, savedConversation] = await Promise.all([
        getUserBaseline(),
        getTodaysMeals(),
        getRecentCheckIns(7),
        loadWeeklyConversation(),
      ]);

      setBaseline(userBaseline);
      setTodaysMeals(meals);

      const today = new Date().toISOString().split('T')[0];
      // Prefer freshCheckIn if provided (just completed), otherwise find from recent
      const todayCheck = freshCheckIn || recentCheckIns.find(c => c.check_in_date === today);
      setTodaysCheckIn(todayCheck || null);

      const analysis = analyzeCheckIns(recentCheckIns);
      setCheckInAnalysis(analysis);

      // If we have saved conversation AND no fresh check-in, load history
      if (savedConversation.length > 0 && !freshCheckIn) {
        // Load existing conversation
        const loadedMessages: Message[] = savedConversation.map(m => ({
          role: m.role,
          content: m.content,
        }));
        setMessages(loadedMessages);
        setHasLoadedHistory(true);

        // NOTE: We intentionally do NOT backfill focus points from conversation history here.
        // Only focus points generated from TODAY's check-in should appear on the dashboard.
        // If the user was chatting about future dates, those focus points should not override
        // today's coaching plan. The dashboard already loads today's focus points from
        // the daily_checkins table which is date-filtered.
      } else if (freshCheckIn) {
        // Fresh check-in just submitted — call the AI coach for a comprehensive response
        setHasLoadedHistory(true);
        setIsInitializing(false);
        
        // Show a loading message while we get the AI response
        setMessages([{ role: "assistant", content: "Let me take a look at your check-in..." }]);
        setIsLoading(true);
        
        try {
          // Build check-in context
          const checkInContext = formatCheckInsForAI(recentCheckIns, analysis);
          
          const { data, error } = await supabase.functions.invoke("ai-coach", {
            body: {
              message: `I just completed my daily check-in. Here's how I'm feeling today:
- Mood: ${freshCheckIn.mood}/5
- Energy: ${freshCheckIn.energy_level}/5
- Sleep quality: ${freshCheckIn.sleep_quality}/5
- Stress: ${freshCheckIn.stress_level}/5
${freshCheckIn.sleep_hours ? `- Sleep hours: ${freshCheckIn.sleep_hours}` : ''}
${freshCheckIn.notes ? `- Notes: ${freshCheckIn.notes}` : ''}

Please give me a comprehensive game plan for my day based on how I'm feeling.`,
              userContext: userBaseline ? {
                userName: userBaseline.name,
                primaryGoal: userBaseline.primary_goal,
                secondaryGoals: userBaseline.secondary_goals,
                sex: userBaseline.sex,
                age: userBaseline.age,
                targetCalories: userBaseline.target_calories,
                proteinGrams: userBaseline.protein_grams,
                carbsGrams: userBaseline.carbs_grams,
                fatsGrams: userBaseline.fats_grams,
                waterLiters: userBaseline.water_liters,
                activityLevel: userBaseline.activity_level,
                trainingDays: userBaseline.training_days,
                trainingIntensity: userBaseline.training_intensity,
                sleepHours: userBaseline.sleep_hours,
                stressLevel: userBaseline.stress_level,
                occupation: userBaseline.occupation,
                eatingSpeed: userBaseline.eating_speed,
                hungerPatterns: userBaseline.hunger_patterns,
                cravingsTriggers: userBaseline.cravings_triggers,
                emotionalEating: userBaseline.emotional_eating,
                snackingHabits: userBaseline.snacking_habits,
                hydrationHabits: userBaseline.hydration_habits,
                energyPatterns: userBaseline.energy_patterns,
                biggestChallenge: userBaseline.biggest_challenge,
                pastDiets: userBaseline.past_diets,
                weekendHabits: userBaseline.weekend_habits,
                eatingOutFrequency: userBaseline.eating_out_frequency,
                motivationStyle: userBaseline.motivation_style,
                accountabilityPreference: userBaseline.accountability_preference,
                dietType: userBaseline.diet_type,
                foodDislikes: userBaseline.food_dislikes,
                allergies: userBaseline.allergies,
                conditions: userBaseline.conditions,
                coachingTone: userBaseline.coaching_tone,
                focusPoints: userBaseline.focus_points,
                mealsPerDay: userBaseline.meals_per_day,
                mealPrepTime: userBaseline.meal_prep_time,
                cookingSkill: userBaseline.cooking_skill,
                proteinShakesPreference: userBaseline.protein_shakes_preference,
                currentPhase: userBaseline.current_phase,
                cycleRegularity: userBaseline.cycle_regularity,
                cycleSymptoms: userBaseline.cycle_symptoms,
                cyclePhaseTodayCheckin: (todaysCheckIn as any)?.cycle_phase_today || undefined,
                checkInContext: checkInContext,
                preferredLanguage: language as Language,
                lastProgressUpdate: userBaseline.last_progress_update || undefined,
                lastDailyCheckin: freshCheckIn?.check_in_date || undefined,
              } : {},
              todaysMeals: meals.map(m => ({
                name: m.name,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fats: m.fats
              }))
            }
          });

          if (error) throw error;
          
          // Parse daily focus points from the AI response for dashboard
          const { cleanResponse, focusPoints } = parseDailyFocusPoints(data.response);
          
          // Save focus points to database for persistence (uses clean response for storage)
          if (focusPoints.length > 0) {
            await saveDailyFocusPoints(cleanResponse, focusPoints);
            
            // Also pass to parent for immediate display on dashboard
            if (onDailyFocusPointsReceived) {
              onDailyFocusPointsReceived(focusPoints);
            }
          }
          
          // For chat display, keep the full response but strip marker tags only
          const displayResponse = data.response
            .replace(/---DAILY_FOCUS---/g, '\n\n**Today\'s Focus:**\n')
            .replace(/---END_DAILY_FOCUS---/g, '')
            .trim();
          
          setMessages([{ role: "assistant", content: displayResponse }]);
        } catch (error) {
          console.error("Error getting check-in response:", error);
          setMessages([{
            role: "assistant",
            content: "Hey! I saw your check-in. How are you feeling and what can I help with today?"
          }]);
        } finally {
          setIsLoading(false);
        }
        return; // Exit early since we handled everything
      } else {
        // No saved conversation and no fresh check-in — generate simple greeting
        const firstName = userBaseline?.name?.split(' ')[0] || '';
        const greetParts: string[] = [];
        
        greetParts.push(`Hey${firstName ? ` ${firstName}` : ''}!`);
        
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
        const greeting = greetParts.join(" ");

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
            cyclePhaseTodayCheckin: (todaysCheckIn as any)?.cycle_phase_today || undefined,
            // Check-in data
            checkInContext: checkInContext,
            checkInAnalysis: analysis.recommendations.length > 0 ? analysis : null,
            // Language preference
            preferredLanguage: language as Language,
            // App state
            lastProgressUpdate: baseline.last_progress_update || undefined,
            lastDailyCheckin: todaysCheckIn?.check_in_date || undefined,
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
      <SafeAreaContainer overlay className="items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your data...</p>
        </div>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer overlay className="animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
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
        {messages.map((msg, index) => {
          // Keep the full response but strip marker tags for display
          const displayContent = msg.role === "assistant" 
            ? msg.content
                .replace(/---DAILY_FOCUS---/g, '')
                .replace(/---END_DAILY_FOCUS---/g, '')
                .trim()
            : msg.content;

          return (
            <div key={index} className="space-y-3">
              <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
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
                  <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                </div>
              </div>

            </div>
          );
        })}
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
      <div className="px-4 py-4 border-t border-border">
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
    </SafeAreaContainer>
  );
};
