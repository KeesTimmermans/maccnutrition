import { useNavigate } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";

export const QuickMeals = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/quick-add")}
      className="w-full p-4 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary hover:bg-accent/50 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Clock className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <h3 className="font-semibold text-foreground">Quick Add Meals</h3>
        <p className="text-sm text-muted-foreground">Re-log meals from the last 5 days</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
    </button>
  );
};