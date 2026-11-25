import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import macLogo from "@/assets/mac-nutrition-logo.png";
import { track } from "@/lib/analytics";

/** Final signup screen: offer the starting Nutrition Score. */
export const NutritionScoreOffer = ({ onStart, onLater }: { onStart: () => void; onLater: () => void }) => (
  <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 safe-pt-4 safe-pb-4">
    <img src={macLogo} alt="MacNutrition" className="h-12 mb-8" style={{ mixBlendMode: "multiply" }} />
    <div className="w-14 h-14 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground mb-5">
      <Sparkles className="w-7 h-7" />
    </div>
    <h1 className="text-2xl font-bold text-foreground text-center">Get your starting Nutrition Score</h1>
    <p className="text-muted-foreground text-center mt-2">16 quick questions, about 3 minutes, included with your plan.</p>
    <div className="w-full max-w-sm mt-8 space-y-3">
      <Button variant="hero" size="lg" className="w-full" onClick={() => { track("nutrition_score_offer", { choice: "start" }); onStart(); }}>
        Start
      </Button>
      <Button variant="ghost" size="lg" className="w-full" onClick={() => { track("nutrition_score_offer", { choice: "later" }); onLater(); }}>
        Do it later
      </Button>
    </div>
  </div>
);
