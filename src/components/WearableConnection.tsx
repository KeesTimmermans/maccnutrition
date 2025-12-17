import { Watch, Smartphone, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import cjtLogo from "@/assets/cjt-logo.png";

interface WearableConnectionProps {
  onConnect: (type: "wearable" | "questionnaire") => void;
}

export const WearableConnection = ({ onConnect }: WearableConnectionProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10 animate-slide-up">
        <img src={cjtLogo} alt="CJT Nutrition" className="h-16 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-foreground mb-3">
          Let us Personalize Your Experience
        </h1>
        <p className="text-muted-foreground max-w-md">
          Connect your wearable for real-time insights, or complete our onboarding questionnaire to get started.
        </p>
      </div>

      {/* Options */}
      <div className="w-full max-w-md space-y-4">
        {/* Wearable Option */}
        <button
          onClick={() => onConnect("wearable")}
          className="w-full bg-card rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300 flex items-center gap-4 group animate-slide-up delay-100"
        >
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Watch className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-bold text-foreground mb-1">Connect Wearable</h3>
            <p className="text-sm text-muted-foreground">
              Apple Watch, Fitbit, Garmin & more
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </button>

        {/* Questionnaire Option */}
        <button
          onClick={() => onConnect("questionnaire")}
          className="w-full bg-card rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300 flex items-center gap-4 group animate-slide-up delay-200"
        >
          <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
            <Smartphone className="w-7 h-7 text-secondary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-bold text-foreground mb-1">Onboarding Questionnaire</h3>
            <p className="text-sm text-muted-foreground">
              5 steps • Takes 3-5 minutes
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </button>
      </div>

      {/* Benefits */}
      <div className="mt-10 w-full max-w-md animate-slide-up delay-300">
        <p className="text-sm font-semibold text-muted-foreground mb-4 text-center">
          WHY THIS HELPS
        </p>
        <div className="space-y-3">
          {[
            "Personalized macro targets based on your activity",
            "Smart meal suggestions tailored to your goals",
            "Real-time feedback that adapts to you",
          ].map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
