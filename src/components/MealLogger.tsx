import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  Camera, X, Sparkles, Search, Loader2, Heart, Trash2, Scale, 
  ChevronRight, ScanBarcode, MessageSquareText, ArrowLeft, Plus, Minus, Upload, Pencil
} from "lucide-react";
import { 
  analyzeFoodImage, 
  searchFoodSuggestions, 
  getFoodNutritionByWeight, 
  analyzeFoodSearch,
  parseMealDescription,
  type FoodSuggestion,
  type ParsedIngredient,
  type UserDietContext
} from "@/lib/mealService";
import { getFavoriteMeals, deleteFavoriteMeal, FavoriteMeal } from "@/lib/favoriteMealService";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { BarcodeScanner } from "./BarcodeScanner";
import { QuickMeals } from "./QuickMeals";
import { getReinforcementMessage } from "@/lib/encouragementMessages";

interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

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
  userDietContext?: UserDietContext;
  currentDayTotals?: DailyTotals;
  dailyTargets?: DailyTotals;
}

interface AnalysisResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: string;
  notes: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
  defaultServingSize?: number;
}

interface AdjustableIngredient extends ParsedIngredient {
  adjustedGrams: number;
}

type TrackingMethod = 'select' | 'barcode' | 'describe' | 'photo' | 'upload';
type LoggerStep = 'method' | 'search' | 'barcode' | 'describe' | 'photo' | 'upload' | 'quantity' | 'adjust' | 'adjust_ingredients' | 'confirm';

export const MealLogger = ({ onClose, onSubmit, userDietContext, currentDayTotals, dailyTargets }: MealLoggerProps) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<LoggerStep>('method');
  const [trackingMethod, setTrackingMethod] = useState<TrackingMethod>('select');
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
  const [mealDescription, setMealDescription] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [ingredients, setIngredients] = useState<AdjustableIngredient[]>([]);
  const [mealName, setMealName] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  // Calculate totals from ingredients
  const calculateTotals = useCallback(() => {
    return ingredients.reduce(
      (acc, ing) => {
        const factor = ing.adjustedGrams / 100;
        return {
          calories: acc.calories + Math.round(ing.caloriesPer100g * factor),
          protein: acc.protein + Math.round(ing.proteinPer100g * factor),
          carbs: acc.carbs + Math.round(ing.carbsPer100g * factor),
          fats: acc.fats + Math.round(ing.fatsPer100g * factor),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  }, [ingredients]);

  // Get current meal macros (either from ingredients or analysisResult)
  const getCurrentMealMacros = useCallback(() => {
    if (ingredients.length > 0) {
      return calculateTotals();
    } else if (analysisResult) {
      return {
        calories: analysisResult.calories,
        protein: analysisResult.protein,
        carbs: analysisResult.carbs,
        fats: analysisResult.fats,
      };
    }
    return { calories: 0, protein: 0, carbs: 0, fats: 0 };
  }, [ingredients, analysisResult, calculateTotals]);

  // Calculate projected daily totals including current meal
  const projectedDayTotals = useCallback(() => {
    const mealMacros = getCurrentMealMacros();
    const current = currentDayTotals || { calories: 0, protein: 0, carbs: 0, fats: 0 };
    return {
      calories: current.calories + mealMacros.calories,
      protein: current.protein + mealMacros.protein,
      carbs: current.carbs + mealMacros.carbs,
      fats: current.fats + mealMacros.fats,
    };
  }, [getCurrentMealMacros, currentDayTotals]);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setImage(base64);
        setIsAnalyzing(true);
        
        try {
          const result = await analyzeFoodImage(base64, userDietContext);
          setMealName(result.mealName);
          setConfidence(result.confidence);
          setNotes(result.notes);
          setIngredients(
            result.ingredients.map((ing) => ({
              ...ing,
              adjustedGrams: ing.estimatedGrams,
            }))
          );
          setStep('adjust_ingredients');
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
    const sanitized = value.replace(/[^0-9.]/g, '');
    setQuantity(sanitized);
  };

  const handleBarcodeDetected = async (barcode: string) => {
    setShowBarcodeScanner(false);
    setIsAnalyzing(true);
    
    try {
      // Use barcode mode - tries Open Food Facts first, then AI fallback
      const result = await analyzeFoodSearch(barcode, 'barcode');
      setAnalysisResult({
        ...result,
        caloriesPer100g: result.caloriesPer100g || result.calories,
        proteinPer100g: result.proteinPer100g || result.protein,
        carbsPer100g: result.carbsPer100g || result.carbs,
        fatsPer100g: result.fatsPer100g || result.fats,
        defaultServingSize: result.defaultServingSize || 100,
      });
      setQuantity((result.defaultServingSize || 100).toString());
      setStep('adjust');
      
      // Show source info
      if (result.source === 'open_food_facts') {
        toast.success(`Found: ${result.name}`);
      } else if (result.source === 'ai_estimation') {
        toast.info("Product not in database - using AI estimate");
      }
    } catch (error) {
      console.error("Error looking up barcode:", error);
      toast.error("Could not find product. Try searching manually.");
      setStep('method');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDescriptionSubmit = async () => {
    if (!mealDescription.trim()) {
      toast.error("Please describe your meal");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await parseMealDescription(mealDescription, userDietContext);
      setMealName(result.mealName);
      setConfidence(result.confidence);
      setNotes(result.notes);
      setIngredients(
        result.ingredients.map((ing) => ({
          ...ing,
          adjustedGrams: ing.estimatedGrams,
        }))
      );
      setStep('adjust_ingredients');
    } catch (error) {
      console.error("Error analyzing description:", error);
      toast.error(t('error'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleIngredientQuantityChange = (index: number, newGrams: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) =>
        i === index ? { ...ing, adjustedGrams: Math.max(0, newGrams) } : ing
      )
    );
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdjustQuantity = (newQuantity: number) => {
    if (!analysisResult || !analysisResult.caloriesPer100g) return;
    
    const factor = newQuantity / 100;
    setAnalysisResult({
      ...analysisResult,
      calories: Math.round(analysisResult.caloriesPer100g * factor),
      protein: Math.round(analysisResult.proteinPer100g! * factor),
      carbs: Math.round(analysisResult.carbsPer100g! * factor),
      fats: Math.round(analysisResult.fatsPer100g! * factor),
      defaultServingSize: newQuantity,
    });
    setQuantity(newQuantity.toString());
  };

  const handleSubmitMeal = () => {
    if (ingredients.length > 0) {
      const totals = calculateTotals();
      onSubmit({
        name: mealName || "Custom Meal",
        imageUrl: image || undefined,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fats: totals.fats,
      });
    } else if (analysisResult) {
      onSubmit({
        name: analysisResult.name,
        imageUrl: image || undefined,
        calories: analysisResult.calories,
        protein: analysisResult.protein,
        carbs: analysisResult.carbs,
        fats: analysisResult.fats,
      });
    }
    
    // Show positive reinforcement after successful log
    const name = (mealName || analysisResult?.name || "").toLowerCase();
    const mealType = name.includes('breakfast') ? 'breakfast' 
      : name.includes('lunch') ? 'lunch' 
      : name.includes('dinner') ? 'dinner' 
      : undefined;
    toast.success(getReinforcementMessage('meal', { mealType }));
    
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
    
    // Show positive reinforcement after successful log
    const mealType = fav.name.toLowerCase().includes('breakfast') ? 'breakfast' 
      : fav.name.toLowerCase().includes('lunch') ? 'lunch' 
      : fav.name.toLowerCase().includes('dinner') ? 'dinner' 
      : undefined;
    toast.success(getReinforcementMessage('meal', { mealType }));
    
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
    if (step === 'search' || step === 'barcode' || step === 'describe' || step === 'photo' || step === 'upload') {
      setStep('method');
      setTrackingMethod('select');
      setImage(null);
      setSearchQuery("");
      setSuggestions([]);
      setMealDescription("");
      setIngredients([]);
    } else if (step === 'quantity') {
      setStep('search');
      setSelectedFood(null);
    } else if (step === 'adjust') {
      if (trackingMethod === 'barcode') {
        setStep('method');
        setTrackingMethod('select');
      } else {
        setStep('method');
      }
      setAnalysisResult(null);
    } else if (step === 'adjust_ingredients') {
      // Check if we came from the adjust step (barcode/search flow)
      if (analysisResult) {
        setStep('adjust');
        setIngredients([]);
      } else if (trackingMethod === 'describe') {
        setStep('describe');
        setIngredients([]);
      } else if (trackingMethod === 'photo') {
        setStep('photo');
        setImage(null);
        setIngredients([]);
      } else if (trackingMethod === 'upload') {
        setStep('upload');
        setImage(null);
        setIngredients([]);
      } else {
        setStep('method');
        setIngredients([]);
      }
    } else if (step === 'confirm') {
      if (selectedFood) {
        setStep('quantity');
      } else {
        setStep('adjust');
      }
    }
  };

  const selectMethod = (method: TrackingMethod) => {
    setTrackingMethod(method);
    if (method === 'barcode') {
      setStep('barcode');
      setShowBarcodeScanner(true);
    } else if (method === 'describe') {
      setStep('describe');
    } else if (method === 'photo') {
      setStep('photo');
    } else if (method === 'upload') {
      setStep('upload');
    }
  };

  const getConfidenceLabel = (conf: string) => {
    switch (conf) {
      case 'high': return t('high_confidence');
      case 'medium': return t('medium_confidence');
      default: return t('low_confidence');
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'method': return t('log_meal');
      case 'search': return 'Search Food';
      case 'barcode': return 'Scan Barcode';
      case 'describe': return 'Describe Your Meal';
      case 'photo': return 'Take Photo';
      case 'upload': return 'Upload Photo';
      case 'quantity': return 'Set Quantity';
      case 'adjust': return 'Adjust Serving';
      case 'adjust_ingredients': return 'Adjust Ingredients';
      case 'confirm': return 'Confirm Meal';
      default: return t('log_meal');
    }
  };

  // Method selection screen
  const renderMethodSelection = () => (
    <div className="space-y-4">
      {/* Quick Meals Navigation Button */}
      <QuickMeals />

      <p className="text-muted-foreground text-center mb-6">
        Choose how you'd like to log your meal
      </p>
      
      {/* Barcode Scan Option */}
      <button
        onClick={() => selectMethod('barcode')}
        className="w-full p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary hover:bg-accent/50 transition-all group"
      >
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <ScanBarcode className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">Scan Barcode</h3>
          <p className="text-sm text-muted-foreground">Scan a product barcode for instant macros</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Describe Meal Option */}
      <button
        onClick={() => selectMethod('describe')}
        className="w-full p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary hover:bg-accent/50 transition-all group"
      >
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <MessageSquareText className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">Describe Your Meal</h3>
          <p className="text-sm text-muted-foreground">Write what you ate and we'll extract each ingredient</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Photo Option */}
      <button
        onClick={() => selectMethod('photo')}
        className="w-full p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary hover:bg-accent/50 transition-all group"
      >
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Camera className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">Take a Photo</h3>
          <p className="text-sm text-muted-foreground">Use your camera to capture your meal</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Upload Photo Option */}
      <button
        onClick={() => selectMethod('upload')}
        className="w-full p-5 bg-card border border-border rounded-2xl flex items-center gap-4 hover:border-primary hover:bg-accent/50 transition-all group"
      >
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">Upload Photo</h3>
          <p className="text-sm text-muted-foreground">Choose an image from your gallery</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Quick Search Divider */}
      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-sm text-muted-foreground">or search manually</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder={t('search_food')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length >= 2) {
              setStep('search');
            }
          }}
          className="w-full pl-12 pr-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );

  // Barcode scanner screen
  const renderBarcodeStep = () => (
    <div className="space-y-4">
      {showBarcodeScanner ? (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => {
            setShowBarcodeScanner(false);
            setStep('method');
          }}
        />
      ) : isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Looking up product...</p>
        </div>
      ) : null}
    </div>
  );

  // Describe meal screen
  const renderDescribeStep = () => (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Describe everything you ate including quantities. Each ingredient will be listed separately for you to adjust.
        <span className="block text-foreground mt-2 italic">
          "2 eggs scrambled with cheese, 2 slices of toast with butter, and a glass of orange juice"
        </span>
      </p>
      
      <textarea
        value={mealDescription}
        onChange={(e) => setMealDescription(e.target.value)}
        placeholder="Describe your meal in detail..."
        className="w-full h-40 p-4 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        autoFocus
      />

      {isAnalyzing && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-muted-foreground">Identifying ingredients...</p>
        </div>
      )}
    </div>
  );

  // Photo capture screen
  const renderPhotoStep = () => (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />

      {image ? (
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
          <img src={image} alt="Meal" className="w-full h-full object-cover" />
          {isAnalyzing && (
            <div className="absolute inset-0 bg-foreground/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              <p className="text-primary-foreground font-semibold">Identifying ingredients...</p>
            </div>
          )}
          <button
            onClick={() => {
              setImage(null);
              setIngredients([]);
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
            <p className="text-sm text-muted-foreground">AI will identify each ingredient</p>
          </div>
        </button>
      )}
    </div>
  );

  // Upload photo step
  const renderUploadStep = () => (
    <div className="animate-slide-up space-y-4">
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageCapture}
        className="hidden"
      />

      {image ? (
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
          <img src={image} alt="Meal" className="w-full h-full object-cover" />
          {isAnalyzing && (
            <div className="absolute inset-0 bg-foreground/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-primary-foreground animate-spin" />
              <p className="text-primary-foreground font-semibold">Identifying ingredients...</p>
            </div>
          )}
          <button
            onClick={() => {
              setImage(null);
              setIngredients([]);
            }}
            className="absolute top-3 right-3 p-2 bg-foreground/50 rounded-full hover:bg-foreground/70 transition-colors"
          >
            <X className="w-5 h-5 text-primary-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="w-full aspect-video rounded-2xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-accent/50 transition-all duration-300"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-bold text-foreground">Upload Photo</p>
            <p className="text-sm text-muted-foreground">Choose an image from your gallery</p>
          </div>
        </button>
      )}
    </div>
  );

  // Search step (manual food search)
  const renderSearchStep = () => (
    <>
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

      {searchQuery.length >= 2 && !isSearching && suggestions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No foods found. Try a different search term.
        </p>
      )}
    </>
  );

  // Quantity step for manual search
  const renderQuantityStep = () => (
    <div className="animate-slide-up">
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

  // Convert single analysis result to editable ingredients
  const handleSwitchToIngredientMode = () => {
    if (analysisResult) {
      const ingredient: AdjustableIngredient = {
        name: analysisResult.name,
        estimatedGrams: parseFloat(quantity) || 100,
        caloriesPer100g: analysisResult.caloriesPer100g || analysisResult.calories,
        proteinPer100g: analysisResult.proteinPer100g || analysisResult.protein,
        carbsPer100g: analysisResult.carbsPer100g || analysisResult.carbs,
        fatsPer100g: analysisResult.fatsPer100g || analysisResult.fats,
        adjustedGrams: parseFloat(quantity) || 100,
      };
      setMealName(analysisResult.name);
      setIngredients([ingredient]);
      setStep('adjust_ingredients');
    }
  };

  // Add a new empty ingredient
  const handleAddIngredient = () => {
    const newIngredient: AdjustableIngredient = {
      name: "New ingredient",
      estimatedGrams: 100,
      caloriesPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatsPer100g: 0,
      adjustedGrams: 100,
    };
    setIngredients(prev => [...prev, newIngredient]);
  };

  // Update ingredient name
  const handleIngredientNameChange = (index: number, newName: string) => {
    setIngredients(prev =>
      prev.map((ing, i) =>
        i === index ? { ...ing, name: newName } : ing
      )
    );
  };

  // Update ingredient nutrition (for manual entry)
  const handleIngredientNutritionChange = (index: number, field: 'caloriesPer100g' | 'proteinPer100g' | 'carbsPer100g' | 'fatsPer100g', value: number) => {
    setIngredients(prev =>
      prev.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      )
    );
  };

  // Adjust step - for barcode with manual quantity adjustment
  const renderAdjustStep = () => (
    <div className="animate-slide-up space-y-6">
      {image && (
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted">
          <img src={image} alt="Meal" className="w-full h-full object-cover" />
        </div>
      )}

      {analysisResult && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">{analysisResult.name}</h3>
            {analysisResult.confidence && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
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

          {/* Quantity Adjuster */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-muted-foreground mb-3">
              Adjust serving size (grams)
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleAdjustQuantity(Math.max(10, parseFloat(quantity) - 10))}
                className="w-12 h-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>
              <div className="relative w-32">
                <input
                  type="text"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setQuantity(val);
                    if (parseFloat(val) > 0) {
                      handleAdjustQuantity(parseFloat(val));
                    }
                  }}
                  className="w-full px-4 py-3 text-2xl font-bold bg-muted rounded-xl text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g</span>
              </div>
              <button
                onClick={() => handleAdjustQuantity(parseFloat(quantity) + 10)}
                className="w-12 h-12 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {/* Quick adjust buttons */}
            <div className="flex justify-center gap-2 mt-3">
              {[50, 100, 150, 200, 250].map((q) => (
                <button
                  key={q}
                  onClick={() => handleAdjustQuantity(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    parseInt(quantity) === q
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {q}g
                </button>
              ))}
            </div>
          </div>

          {/* Macro display */}
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
            <p className="text-xs text-muted-foreground mt-4">{analysisResult.notes}</p>
          )}

          {/* Daily total preview - only show if we have current day totals */}
          {currentDayTotals && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-3">Today's total (after logging):</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().calories > dailyTargets.calories ? 'text-destructive' : 'text-calories'}`}>
                    {projectedDayTotals().calories}
                  </p>
                  {dailyTargets && (
                    <p className="text-xs text-muted-foreground">/ {dailyTargets.calories}</p>
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().protein >= dailyTargets.protein ? 'text-green-500' : 'text-protein'}`}>
                    {projectedDayTotals().protein}g
                  </p>
                  {dailyTargets && (
                    <p className="text-xs text-muted-foreground">/ {dailyTargets.protein}g</p>
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().carbs > dailyTargets.carbs ? 'text-destructive' : 'text-carbs'}`}>
                    {projectedDayTotals().carbs}g
                  </p>
                  {dailyTargets && (
                    <p className="text-xs text-muted-foreground">/ {dailyTargets.carbs}g</p>
                  )}
                </div>
                <div>
                  <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().fats > dailyTargets.fats ? 'text-destructive' : 'text-fats'}`}>
                    {projectedDayTotals().fats}g
                  </p>
                  {dailyTargets && (
                    <p className="text-xs text-muted-foreground">/ {dailyTargets.fats}g</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Switch to ingredient mode button */}
      <button
        onClick={handleSwitchToIngredientMode}
        className="w-full py-3 text-sm font-medium text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
      >
        <MessageSquareText className="w-4 h-4" />
        Wrong item? Edit as ingredients
      </button>
    </div>
  );

  // Adjust ingredients step - for describe/photo with individual ingredient adjustment
  const renderAdjustIngredientsStep = () => {
    const totals = calculateTotals();
    
    return (
      <div className="animate-slide-up space-y-4">
        {image && (
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted">
            <img src={image} alt="Meal" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Meal header */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground flex-1">{mealName}</h3>
          {confidence && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              confidence === 'high' 
                ? 'bg-green-500/10 text-green-500' 
                : confidence === 'medium'
                ? 'bg-yellow-500/10 text-yellow-500'
                : 'bg-red-500/10 text-red-500'
            }`}>
              {getConfidenceLabel(confidence)}
            </span>
          )}
        </div>

        {/* Ingredients list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Adjust each ingredient:</p>
            <button
              onClick={handleAddIngredient}
              className="text-xs font-medium text-primary flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" />
              Add ingredient
            </button>
          </div>
          
          {ingredients.map((ing, index) => {
            const factor = ing.adjustedGrams / 100;
            const ingCalories = Math.round(ing.caloriesPer100g * factor);
            const ingProtein = Math.round(ing.proteinPer100g * factor);
            const ingCarbs = Math.round(ing.carbsPer100g * factor);
            const ingFats = Math.round(ing.fatsPer100g * factor);
            
            return (
              <div key={index} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => handleIngredientNameChange(index, e.target.value)}
                      className="font-medium text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none w-full"
                      placeholder="Ingredient name"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {ingCalories} cal • P:{ingProtein}g • C:{ingCarbs}g • F:{ingFats}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveIngredient(index)}
                    className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
                
                {/* Quantity adjuster */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => handleIngredientQuantityChange(index, ing.adjustedGrams - 10)}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ing.adjustedGrams}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                        handleIngredientQuantityChange(index, val);
                      }}
                      className="w-full px-3 py-2 text-lg font-bold bg-muted rounded-lg text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g</span>
                  </div>
                  <button
                    onClick={() => handleIngredientQuantityChange(index, ing.adjustedGrams + 10)}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Nutrition per 100g (editable for manual entries) */}
                {ing.caloriesPer100g === 0 && (
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="text-muted-foreground block mb-1">Cal/100g</label>
                      <input
                        type="number"
                        value={ing.caloriesPer100g}
                        onChange={(e) => handleIngredientNutritionChange(index, 'caloriesPer100g', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-muted rounded text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">P/100g</label>
                      <input
                        type="number"
                        value={ing.proteinPer100g}
                        onChange={(e) => handleIngredientNutritionChange(index, 'proteinPer100g', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-muted rounded text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">C/100g</label>
                      <input
                        type="number"
                        value={ing.carbsPer100g}
                        onChange={(e) => handleIngredientNutritionChange(index, 'carbsPer100g', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-muted rounded text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">F/100g</label>
                      <input
                        type="number"
                        value={ing.fatsPer100g}
                        onChange={(e) => handleIngredientNutritionChange(index, 'fatsPer100g', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-muted rounded text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total summary */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <p className="text-sm font-medium text-foreground mb-3">Total for this meal:</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-calories">{totals.calories}</p>
              <p className="text-xs text-muted-foreground">cal</p>
            </div>
            <div>
              <p className="text-xl font-bold text-protein">{totals.protein}g</p>
              <p className="text-xs text-muted-foreground">protein</p>
            </div>
            <div>
              <p className="text-xl font-bold text-carbs">{totals.carbs}g</p>
              <p className="text-xs text-muted-foreground">carbs</p>
            </div>
            <div>
              <p className="text-xl font-bold text-fats">{totals.fats}g</p>
              <p className="text-xs text-muted-foreground">fats</p>
            </div>
          </div>
        </div>

        {/* Daily total preview - only show if we have current day totals */}
        {currentDayTotals && (
          <div className="bg-accent/50 border border-border rounded-xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">Today's total (after logging):</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().calories > dailyTargets.calories ? 'text-destructive' : 'text-calories'}`}>
                  {projectedDayTotals().calories}
                </p>
                {dailyTargets && (
                  <p className="text-xs text-muted-foreground">/ {dailyTargets.calories}</p>
                )}
              </div>
              <div>
                <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().protein >= dailyTargets.protein ? 'text-green-500' : 'text-protein'}`}>
                  {projectedDayTotals().protein}g
                </p>
                {dailyTargets && (
                  <p className="text-xs text-muted-foreground">/ {dailyTargets.protein}g</p>
                )}
              </div>
              <div>
                <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().carbs > dailyTargets.carbs ? 'text-destructive' : 'text-carbs'}`}>
                  {projectedDayTotals().carbs}g
                </p>
                {dailyTargets && (
                  <p className="text-xs text-muted-foreground">/ {dailyTargets.carbs}g</p>
                )}
              </div>
              <div>
                <p className={`text-lg font-bold ${dailyTargets && projectedDayTotals().fats > dailyTargets.fats ? 'text-destructive' : 'text-fats'}`}>
                  {projectedDayTotals().fats}g
                </p>
                {dailyTargets && (
                  <p className="text-xs text-muted-foreground">/ {dailyTargets.fats}g</p>
                )}
              </div>
            </div>
          </div>
        )}

        {notes && (
          <p className="text-xs text-muted-foreground">{notes}</p>
        )}
      </div>
    );
  };

  // Confirm step
  const renderConfirmStep = () => (
    <div className="animate-scale-in">
      {image && (
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted mb-6">
          <img src={image} alt="Meal" className="w-full h-full object-cover" />
        </div>
      )}

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
          onClick={step === 'method' ? onClose : handleBack} 
          className="p-2 hover:bg-muted rounded-xl transition-colors"
        >
          {step === 'method' ? (
            <X className="w-6 h-6 text-foreground" />
          ) : (
            <ArrowLeft className="w-6 h-6 text-foreground" />
          )}
        </button>
        <h2 className="font-bold text-lg text-foreground">
          {getStepTitle()}
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
            {step === 'method' && renderMethodSelection()}
            {step === 'search' && renderSearchStep()}
            {step === 'barcode' && renderBarcodeStep()}
            {step === 'describe' && renderDescribeStep()}
            {step === 'photo' && renderPhotoStep()}
            {step === 'upload' && renderUploadStep()}
            {step === 'quantity' && renderQuantityStep()}
            {step === 'adjust' && renderAdjustStep()}
            {step === 'adjust_ingredients' && renderAdjustIngredientsStep()}
            {step === 'confirm' && renderConfirmStep()}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border">
        {step === 'method' && !showFavorites && (
          <p className="text-xs text-muted-foreground text-center">
            Choose a tracking method or search for food
          </p>
        )}

        {step === 'describe' && !isAnalyzing && (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={!mealDescription.trim()}
            onClick={handleDescriptionSubmit}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Analyze My Meal
          </Button>
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

        {step === 'adjust' && (
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

        {step === 'adjust_ingredients' && (
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={ingredients.length === 0}
            onClick={handleSubmitMeal}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {t('log_this_meal')}
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
