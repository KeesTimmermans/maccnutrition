import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Send, Bot, User, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTodaysMeals } from "@/lib/mealService";
import { getUserBaseline } from "@/lib/userService";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICoachChatProps {
  onClose: () => void;
}

export const AICoachChat = ({ onClose }: AICoachChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI nutrition coach. I can see your meals and goals - ask me anything about nutrition, meal suggestions, or how you're tracking today!"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Fetch user context and meals
      const [baseline, todaysMeals] = await Promise.all([
        getUserBaseline(),
        getTodaysMeals()
      ]);

      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          messages: newMessages,
          userContext: baseline ? {
            primaryGoal: baseline.primary_goal,
            targetCalories: baseline.target_calories,
            proteinGrams: baseline.protein_grams,
            carbsGrams: baseline.carbs_grams,
            fatsGrams: baseline.fats_grams,
            activityLevel: baseline.activity_level,
            trainingDays: baseline.training_days,
            sleepHours: baseline.sleep_hours,
            stressLevel: baseline.stress_level,
            dietType: baseline.diet_type,
            foodDislikes: baseline.food_dislikes,
            coachingTone: baseline.coaching_tone,
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

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">AI Coach</h2>
            <p className="text-xs text-muted-foreground">Powered by your data</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

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
              "What should I eat for dinner?",
              "How can I hit my protein goal?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setInput(suggestion);
                }}
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
