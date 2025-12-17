import { Camera, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MealCardProps {
  meal: {
    id: string;
    name: string;
    time: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    imageUrl?: string;
  };
}

export const MealCard = ({ meal }: MealCardProps) => {
  return (
    <div className="bg-card rounded-2xl shadow-soft p-4 flex gap-4 animate-scale-in hover:shadow-medium transition-shadow duration-300">
      {/* Meal Image */}
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
        {meal.imageUrl ? (
          <img 
            src={meal.imageUrl} 
            alt={meal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute top-1 right-1 bg-primary/90 rounded-full p-1">
          <Sparkles className="w-3 h-3 text-primary-foreground" />
        </div>
      </div>

      {/* Meal Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-foreground truncate">{meal.name}</h4>
            <p className="text-sm text-muted-foreground">{meal.time}</p>
          </div>
          <span className="text-sm font-semibold text-calories bg-accent px-2 py-1 rounded-lg">
            {meal.calories} cal
          </span>
        </div>
        
        {/* Macro Pills */}
        <div className="flex gap-2 mt-2">
          <span className="text-xs font-medium text-protein bg-protein/10 px-2 py-0.5 rounded-full">
            P: {meal.protein}g
          </span>
          <span className="text-xs font-medium text-carbs bg-carbs/10 px-2 py-0.5 rounded-full">
            C: {meal.carbs}g
          </span>
          <span className="text-xs font-medium text-fats bg-fats/10 px-2 py-0.5 rounded-full">
            F: {meal.fats}g
          </span>
        </div>
      </div>
    </div>
  );
};

export const AddMealCard = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className="w-full bg-card/50 border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-accent/50 transition-all duration-300 group"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Plus className="w-6 h-6 text-primary" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-foreground">Log a Meal</p>
        <p className="text-sm text-muted-foreground">Snap a photo or search</p>
      </div>
    </button>
  );
};
