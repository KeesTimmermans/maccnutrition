import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Sparkles, Search, Loader2, Heart, Trash2, Scale, ChevronRight } from "lucide-react";
import { analyzeFoodImage, searchFoodSuggestions, getFoodNutritionByWeight, type FoodSuggestion } from "@/lib/mealService";
import { getFavoriteMeals, deleteFavoriteMeal, FavoriteMeal } from "@/lib/favoriteMealService";
import { useLanguage } from "@/lib/i18n";
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
  // Per 100g values for scaling
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
  defaultServingSize?: number;
}

type LoggerStep = 'search' | 'quantity' | 'confirm';

export const MealLogger = ({ onClose, onSubmit }: MealLoggerProps) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<LoggerStep>('search');
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSuggestion | null>(null);
  const [quantity, setQuantity] = useState<string>("100");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadFavorites = async () => {
      const data = await getFavoriteMeals();
      setFavorites(data);
    };
    loadFavorites();
  }, []);

  // Debounced search for suggestions
  const debouncedSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchFoodSuggestions(query);
      setSuggestions(results);
    } catch (error) {
      console.error("Error searching foods:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        debouncedSearch(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearch]);

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
          setAnalysisResult({
            ...result,
            caloriesPer100g: result.calories,
            proteinPer100g: result.protein,
            carbsPer100g: result.carbs,
            fatsPer100g: result.fats,
            defaultServingSize: 100,
          });
          setStep('confirm');
        } catch (error) {
          console.error("Error analyzing image:", error);
          toast.error(t('error'));
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectFood = (food: FoodSuggestion) => {
    setSelectedFood(food);
    setQuantity(food.defaultServingSize?.toString() || "100");
    setStep('quantity');
  };

  const handleCalculateNutrition = async () => {
    if (!selectedFood || !quantity) return;

    const grams = parseFloat(quantity);
    if (isNaN(grams) || grams <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setIsCalculating(true);
    try {
      const result = await getFoodNutritionByWeight(selectedFood.name, grams);
      setAnalysisResult({
        ...result,
        caloriesPer100g: selectedFood.caloriesPer100g,
        proteinPer100g: selectedFood.proteinPer100g,
        carbsPer100g: selectedFood.carbsPer100g,
        fatsPer100g: selectedFood.fatsPer100g,
        defaultServingSize: grams,
      });
      setStep('confirm');
    } catch (error) {
      console.error("Error calculating nutrition:", error);
      toast.error(t('error'));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleQuantityChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    setQuantity(sanitized);
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

  const handleLogFavorite = (fav: FavoriteMeal) => {
    onSubmit({
      name: fav.name,
      calories: fav.calories,
      protein: fav.protein,
      carbs: fav.carbs,
      fats: fav.fats,
    });
    onClose();
  };

  const handleDeleteFavorite = async (id: string) => {
    try {
      await deleteFavoriteMeal(id);
      setFavorites(prev => prev.filter(f => f.id !== id));
      toast.success(t('removed_favorites'));
    } catch {
      toast.error(t('error'));
    }
  };

  const handleBack = () => {
    if (step === 'quantity') {
      setStep('search');
      setSelectedFood(null);
    } else if (step === 'confirm') {
      if (image) {
        setStep('search');
        setImage(null);
        setAnalysisResult(null);
      } else {
        setStep('quantity');
      }
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high': return t('high_confidence');
      case 'medium': return t('medium_confidence');
      default: return t('low_confidence');
    }
  };

  const renderSearchStep = () => (
    <>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder={t('search_food')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-medium mb-4 max-h-64 overflow-auto">
          {suggestions.map((food, index) => (
            <button
              key={`${food.name}-${index}`}
              onClick={() => handleSelectFood(food)}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between border-b border-border last:border-b-0"
            >
              <div>
                <p className="font-medium text-foreground">{food.name}</p>
                <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{food.caloriesPer100g} cal/100g</span>
                  <span>•</span>
                  <span>P: {food.proteinPer100g}g</span>
                  <span>C: {food.carbsPer100g}g</span>
                  <span>F: {food.fatsPer100g}g</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {searchQuery.length >= 2 && !isSearching && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No foods found. Try a different search term.
        </p>
      )}

      {/* Or divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm text-muted-foreground">{t('or_snap_photo')}</span>
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
              <p className="text-primary-foreground font-semibold">{t('ai_analyzing')}</p>
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
          className="w-full aspect-video rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-accent/50 transition-all duration-300"
        >
          <div className="w-16 h-16 rounded-full gradient-hero flex items-center justify-center">
            <Camera className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="font-bold text-foreground">{t('take_photo')}</p>
            <p className="text-sm text-muted-foreground">{t('ai_analyze_meal')}</p>
          </div>
        </button>
      )}
    </>
  );

  const renderQuantityStep = () => (
    <div className="animate-slide-up">
      {/* Selected food info */}
      {selectedFood && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-6">
          <h3 className="font-bold text-lg text-foreground mb-2">{selectedFood.name}</h3>
          <div className="flex gap-3 text-sm text-muted-foreground">
            <span>{selectedFood.caloriesPer100g} cal</span>
            <span>•</span>
            <span>P: {selectedFood.proteinPer100g}g</span>
            <span>•</span>
            <span>C: {selectedFood.carbsPer100g}g</span>
            <span>•</span>
            <span>F: {selectedFood.fatsPer100g}g</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">per 100g</p>
        </div>
      )}

      {/* Quantity input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          <Scale className="w-4 h-4 inline mr-2" />
          Enter quantity (grams)
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            placeholder="100"
            className="w-full px-4 py-4 text-2xl font-bold bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-center"
            autoFocus
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">g</span>
        </div>
      </div>

      {/* Quick quantity buttons */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[50, 100, 150, 200].map((q) => (
          <button
            key={q}
            onClick={() => setQuantity(q.toString())}
            className={`py-2 rounded-lg text-sm font-medium transition-colors ${
              quantity === q.toString()
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {q}g
          </button>
        ))}
      </div>

      {/* Preview calculation */}
      {selectedFood && quantity && parseFloat(quantity) > 0 && (
        <div className="bg-accent/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-2">Estimated for {quantity}g:</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-calories">
                {Math.round((selectedFood.caloriesPer100g * parseFloat(quantity)) / 100)}
              </p>
              <p className="text-xs text-muted-foreground">cal</p>
            </div>
            <div>
              <p className="text-lg font-bold text-protein">
                {Math.round((selectedFood.proteinPer100g * parseFloat(quantity)) / 100)}g
              </p>
              <p className="text-xs text-muted-foreground">protein</p>
            </div>
            <div>
              <p className="text-lg font-bold text-carbs">
                {Math.round((selectedFood.carbsPer100g * parseFloat(quantity)) / 100)}g
              </p>
              <p className="text-xs text-muted-foreground">carbs</p>
            </div>
            <div>
              <p className="text-lg font-bold text-fats">
                {Math.round((selectedFood.fatsPer100g * parseFloat(quantity)) / 100)}g
              </p>
              <p className="text-xs text-muted-foreground">fats</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="animate-scale-in">
      {image && (
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted mb-6">
          <img src={image} alt="Meal" className="w-full h-full object-cover" />
        </div>
      )}

      {/* AI Analysis Preview */}
      {analysisResult && (
        <div className="bg-card rounded-2xl p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">{t('ai_analysis')}</h3>
            {analysisResult.confidence && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                analysisResult.confidence === 'high' 
                  ? 'bg-green-500/10 text-green-500' 
                  : analysisResult.confidence === 'medium'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {getConfidenceLabel(analysisResult.confidence)}
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('detected')}:</span>
              <span className="font-semibold text-foreground">{analysisResult.name}</span>
            </div>
            {analysisResult.defaultServingSize && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Serving size:</span>
                <span className="font-semibold text-foreground">{analysisResult.defaultServingSize}g</span>
              </div>
            )}
            <div className="h-px bg-border" />
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-accent rounded-xl text-center">
                <p className="text-2xl font-bold text-calories">{analysisResult.calories}</p>
                <p className="text-xs text-muted-foreground">{t('calories')}</p>
              </div>
              <div className="p-3 bg-protein/10 rounded-xl text-center">
                <p className="text-2xl font-bold text-protein">{analysisResult.protein}g</p>
                <p className="text-xs text-muted-foreground">{t('protein')}</p>
              </div>
              <div className="p-3 bg-carbs/10 rounded-xl text-center">
                <p className="text-2xl font-bold text-carbs">{analysisResult.carbs}g</p>
                <p className="text-xs text-muted-foreground">{t('carbs')}</p>
              </div>
              <div className="p-3 bg-fats/10 rounded-xl text-center">
                <p className="text-2xl font-bold text-fats">{analysisResult.fats}g</p>
                <p className="text-xs text-muted-foreground">{t('fats')}</p>
              </div>
            </div>
            {analysisResult.notes && (
              <p className="text-xs text-muted-foreground mt-2">{analysisResult.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button 
          onClick={step === 'search' ? onClose : handleBack} 
          className="p-2 hover:bg-muted rounded-xl transition-colors"
        >
          <X className="w-6 h-6 text-foreground" />
        </button>
        <h2 className="font-bold text-lg text-foreground">
          {step === 'search' && t('log_meal')}
          {step === 'quantity' && 'Set Quantity'}
          {step === 'confirm' && 'Confirm Meal'}
        </h2>
        <button 
          onClick={() => setShowFavorites(!showFavorites)}
          className={`p-2 rounded-xl transition-colors ${showFavorites ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
        >
          <Heart className={`w-5 h-5 ${showFavorites ? 'fill-primary' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Favorites section */}
        {showFavorites ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground mb-3">{t('favorite_meals')}</h3>
            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('no_favorites')}
              </p>
            ) : (
              favorites.map((fav) => (
                <div key={fav.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                  <button 
                    className="flex-1 text-left"
                    onClick={() => handleLogFavorite(fav)}
                  >
                    <p className="font-medium text-foreground">{fav.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                      <span>{fav.calories} cal</span>
                      <span>P: {fav.protein}g</span>
                      <span>C: {fav.carbs}g</span>
                      <span>F: {fav.fats}g</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteFavorite(fav.id)}
                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {step === 'search' && renderSearchStep()}
            {step === 'quantity' && renderQuantityStep()}
            {step === 'confirm' && renderConfirmStep()}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border">
        {step === 'search' && !showFavorites && (
          <p className="text-xs text-muted-foreground text-center">
            Search for a food or take a photo to get started
          </p>
        )}
        
        {step === 'quantity' && (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!quantity || parseFloat(quantity) <= 0 || isCalculating}
            onClick={handleCalculateNutrition}
          >
            {isCalculating ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-5 h-5 mr-2" />
            )}
            Calculate Nutrition
          </Button>
        )}
        
        {step === 'confirm' && (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!analysisResult}
            onClick={handleSubmitMeal}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('log_this_meal')}
          </Button>
        )}
      </div>
    </div>
  );
};