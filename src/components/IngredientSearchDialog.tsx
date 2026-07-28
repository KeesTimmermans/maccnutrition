import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2, X, Pencil, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchFoodSuggestions, type FoodSuggestion } from "@/lib/mealService";
import { useLanguage } from "@/lib/i18n";

export interface IngredientSearchResult {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  quantity: number;
  unit: 'g' | 'ml' | 'serving';
  /** per-unit multiplier for serving-based items */
  servingGrams: number;
  source?: string;
}

interface IngredientSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: IngredientSearchResult) => void;
  /** Pre-fill search for editing existing ingredient */
  initialQuery?: string;
}

export const IngredientSearchDialog = ({
  open,
  onClose,
  onSelect,
  initialQuery = "",
}: IngredientSearchDialogProps) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<FoodSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSuggestion | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState<'g' | 'ml' | 'serving'>('g');
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedFood(null);
      setQuantity("100");
      setUnit('g');
      setManualMode(false);
      setSuggestions([]);
      if (initialQuery) {
        doSearch(initialQuery);
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialQuery]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchFoodSuggestions(q);
      setSuggestions(results);
    } catch (error) {
      console.error("Error searching foods:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedFood(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => doSearch(value), 300);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectFood = (food: FoodSuggestion) => {
    setSelectedFood(food);
    setQuery(food.name);
    setQuantity(food.defaultServingSize?.toString() || "100");
    setManualMode(false);
    setSuggestions([]);
  };

  const computedMacros = selectedFood && quantity
    ? (() => {
        const q = parseFloat(quantity) || 0;
        const factor = unit === 'serving'
          ? (selectedFood.defaultServingSize || 100) / 100 * q
          : q / 100;
        return {
          calories: Math.round(selectedFood.caloriesPer100g * factor),
          protein: Math.round(selectedFood.proteinPer100g * factor),
          carbs: Math.round(selectedFood.carbsPer100g * factor),
          fats: Math.round(selectedFood.fatsPer100g * factor),
        };
      })()
    : null;

  const handleConfirm = () => {
    if (manualMode) {
      const q = parseFloat(quantity) || 100;
      onSelect({
        name: manualName || query || "Unknown",
        caloriesPer100g: (parseFloat(manualCal) || 0) / (q / 100),
        proteinPer100g: (parseFloat(manualProtein) || 0) / (q / 100),
        carbsPer100g: (parseFloat(manualCarbs) || 0) / (q / 100),
        fatsPer100g: (parseFloat(manualFats) || 0) / (q / 100),
        quantity: q,
        unit,
        servingGrams: q,
      });
    } else if (selectedFood) {
      const q = parseFloat(quantity) || 100;
      const servingGrams = unit === 'serving'
        ? (selectedFood.defaultServingSize || 100) * q
        : q;
      onSelect({
        name: selectedFood.name,
        caloriesPer100g: selectedFood.caloriesPer100g,
        proteinPer100g: selectedFood.proteinPer100g,
        carbsPer100g: selectedFood.carbsPer100g,
        fatsPer100g: selectedFood.fatsPer100g,
        quantity: q,
        unit,
        servingGrams,
      });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-bold text-foreground">
            {initialQuery ? "Edit Ingredient" : "Add Ingredient"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!manualMode ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search food..."
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-muted rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Skeleton loading state */}
              {!selectedFood && isSearching && suggestions.length === 0 && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-border last:border-b-0 animate-pulse">
                      <div className="flex-1">
                        <div className="h-4 w-32 bg-muted rounded mb-1.5" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                      <div className="h-4 w-4 bg-muted rounded flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {!selectedFood && suggestions.length > 0 && (
                <div className="bg-card border border-border rounded-xl max-h-48 overflow-auto">
                  {suggestions.map((food, i) => (
                    <button
                      key={`${food.name}-${i}`}
                      onClick={() => handleSelectFood(food)}
                      className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between border-b border-border last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">{food.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {food.caloriesPer100g} cal/100g · P:{food.proteinPer100g}g C:{food.carbsPer100g}g F:{food.fatsPer100g}g
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {!selectedFood && query.length >= 2 && !isSearching && suggestions.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">No results found</p>
                  <button
                    onClick={() => {
                      setManualMode(true);
                      setManualName(query);
                    }}
                    className="text-sm text-primary font-medium hover:underline"
                  >
                    Enter macros manually
                  </button>
                </div>
              )}

              {/* Selected food - quantity & unit */}
              {selectedFood && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="font-medium text-foreground text-sm">{selectedFood.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedFood.caloriesPer100g} cal · P:{selectedFood.proteinPer100g}g C:{selectedFood.carbsPer100g}g F:{selectedFood.fatsPer100g}g per 100g
                    </p>
                  </div>

                  {/* Quantity + Unit */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value.replace(/[^0-9.]/g, ''))}
                        onFocus={(e) => e.target.select()}
                        className="w-full px-3 py-2.5 text-lg font-bold bg-muted rounded-xl text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                      <div className="flex bg-muted rounded-xl overflow-hidden h-[46px]">
                        {(['g', 'ml', 'serving'] as const).map((u) => (
                          <button
                            key={u}
                            onClick={() => {
                              setUnit(u);
                              if (u === 'serving') setQuantity("1");
                            }}
                            className={`flex-1 text-xs font-medium transition-colors ${
                              unit === u
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quick amounts */}
                  {unit !== 'serving' && (
                    <div className="flex gap-2">
                      {[50, 100, 150, 200].map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuantity(q.toString())}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            quantity === q.toString()
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {q}{unit}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Computed macros (read-only) */}
                  {computedMacros && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 bg-accent rounded-lg">
                        <p className="text-lg font-bold text-calories">{computedMacros.calories}</p>
                        <p className="text-[10px] text-muted-foreground">cal</p>
                      </div>
                      <div className="p-2 bg-protein/10 rounded-lg">
                        <p className="text-lg font-bold text-protein">{computedMacros.protein}g</p>
                        <p className="text-[10px] text-muted-foreground">protein</p>
                      </div>
                      <div className="p-2 bg-carbs/10 rounded-lg">
                        <p className="text-lg font-bold text-carbs">{computedMacros.carbs}g</p>
                        <p className="text-[10px] text-muted-foreground">carbs</p>
                      </div>
                      <div className="p-2 bg-fats/10 rounded-lg">
                        <p className="text-lg font-bold text-fats">{computedMacros.fats}g</p>
                        <p className="text-[10px] text-muted-foreground">fats</p>
                      </div>
                    </div>
                  )}

                  {/* Manual edit fallback */}
                  <button
                    onClick={() => {
                      setManualMode(true);
                      setManualName(selectedFood.name);
                      if (computedMacros) {
                        setManualCal(computedMacros.calories.toString());
                        setManualProtein(computedMacros.protein.toString());
                        setManualCarbs(computedMacros.carbs.toString());
                        setManualFats(computedMacros.fats.toString());
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit manually
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Manual mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Manual Entry</p>
                <button
                  onClick={() => setManualMode(false)}
                  className="text-xs text-primary hover:underline"
                >
                  Back to search
                </button>
              </div>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ingredient name"
                className="bg-muted"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-muted"
                  />
                </div>
                <div className="w-16">
                  <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
                  <Input value="g" disabled className="bg-muted text-center" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">{t('calories')}</label>
                  <Input
                    type="number"
                    value={manualCal}
                    onChange={(e) => setManualCal(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('protein')} (g)</label>
                  <Input
                    type="number"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('carbs')} (g)</label>
                  <Input
                    type="number"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('fats')} (g)</label>
                  <Input
                    type="number"
                    value={manualFats}
                    onChange={(e) => setManualFats(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0"
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            disabled={manualMode ? !manualName.trim() : !selectedFood || !quantity || parseFloat(quantity) <= 0}
            onClick={handleConfirm}
          >
            {initialQuery ? "Update Ingredient" : "Add Ingredient"}
          </Button>
        </div>
      </div>
    </div>
  );
};
