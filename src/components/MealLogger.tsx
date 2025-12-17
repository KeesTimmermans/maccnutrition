import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Sparkles, Search, Loader2 } from "lucide-react";
import { analyzeFoodImage, analyzeFoodSearch } from "@/lib/mealService";
import { toast } from "sonner";

interface MealLoggerProps {
  onClose: () => void;
  onSubmit: (meal: {
    name: string;
    imageUrl?: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => void;
}

interface AnalysisResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: string;
  notes: string;
}

export const MealLogger = ({ onClose, onSubmit }: MealLoggerProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImage(base64);
        setIsAnalyzing(true);
        setAnalysisResult(null);
        
        try {
          const result = await analyzeFoodImage(base64);
          setAnalysisResult(result);
        } catch (error) {
          console.error("Error analyzing image:", error);
          toast.error("Failed to analyze image. Please try again.");
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setAnalysisResult(null);
    
    try {
      const result = await analyzeFoodSearch(searchQuery);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Error searching food:", error);
      toast.error("Failed to find nutritional info. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSubmitMeal = () => {
    if (!analysisResult) return;
    
    onSubmit({
      name: analysisResult.name,
      imageUrl: image || undefined,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbs: analysisResult.carbs,
      fats: analysisResult.fats,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h2 className="font-bold text-lg text-foreground">Log Meal</h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for a food..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full pl-12 pr-20 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </button>
          )}
        </div>

        {/* Or divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or snap a photo</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Camera capture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleImageCapture}
          className="hidden"
        />

        {image ? (
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted mb-6">
            <img src={image} alt="Meal" className="w-full h-full object-cover" />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-foreground/50 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
                <p className="text-primary-foreground font-semibold">AI analyzing your meal...</p>
              </div>
            )}
            <button
              onClick={() => {
                setImage(null);
                setAnalysisResult(null);
              }}
              className="absolute top-3 right-3 p-2 bg-foreground/50 rounded-full hover:bg-foreground/70 transition-colors"
            >
              <X className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-accent/50 transition-all duration-300 mb-6"
          >
            <div className="w-20 h-20 rounded-full gradient-hero flex items-center justify-center">
              <Camera className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground">Take a Photo</p>
              <p className="text-sm text-muted-foreground">AI will analyze your meal</p>
            </div>
          </button>
        )}

        {/* AI Analysis Preview */}
        {analysisResult && (
          <div className="bg-card rounded-2xl p-6 shadow-soft animate-scale-in">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">AI Analysis</h3>
              {analysisResult.confidence && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  analysisResult.confidence === 'high' 
                    ? 'bg-green-500/10 text-green-500' 
                    : analysisResult.confidence === 'medium'
                    ? 'bg-yellow-500/10 text-yellow-500'
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {analysisResult.confidence} confidence
                </span>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Detected:</span>
                <span className="font-semibold text-foreground">{analysisResult.name}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-accent rounded-xl text-center">
                  <p className="text-2xl font-bold text-calories">{analysisResult.calories}</p>
                  <p className="text-xs text-muted-foreground">Calories</p>
                </div>
                <div className="p-3 bg-protein/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-protein">{analysisResult.protein}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="p-3 bg-carbs/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-carbs">{analysisResult.carbs}g</p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                </div>
                <div className="p-3 bg-fats/10 rounded-xl text-center">
                  <p className="text-2xl font-bold text-fats">{analysisResult.fats}g</p>
                  <p className="text-xs text-muted-foreground">Fats</p>
                </div>
              </div>
              {analysisResult.notes && (
                <p className="text-xs text-muted-foreground mt-2">{analysisResult.notes}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border">
        <Button
          variant="hero"
          size="xl"
          className="w-full"
          disabled={!analysisResult || isAnalyzing || isSearching}
          onClick={handleSubmitMeal}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Log This Meal
        </Button>
      </div>
    </div>
  );
};
