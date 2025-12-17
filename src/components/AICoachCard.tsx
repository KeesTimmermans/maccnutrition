import { Bot, Lightbulb, TrendingUp, Zap } from "lucide-react";

interface AICoachCardProps {
  greeting?: string;
  insights: string[];
  tip?: string;
}

export const AICoachCard = ({ 
  greeting = "Good morning! Here's your daily insight:",
  insights,
  tip
}: AICoachCardProps) => {
  return (
    <div className="relative overflow-hidden bg-card rounded-2xl shadow-medium p-6 animate-slide-up">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center shadow-soft">
            <Bot className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Your AI Coach</h3>
            <p className="text-sm text-muted-foreground">Powered by your data</p>
          </div>
        </div>

        {/* Greeting */}
        <p className="text-foreground mb-4">{greeting}</p>

        {/* Insights */}
        <div className="space-y-3">
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

        {/* Daily Tip */}
        {tip && (
          <div className="mt-4 p-4 bg-secondary/10 rounded-xl border border-secondary/20">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-secondary">Daily Tip</span>
            </div>
            <p className="text-sm text-foreground">{tip}</p>
          </div>
        )}
      </div>
    </div>
  );
};
