/**
 * Shared Nutrition Pipeline Module
 * 
 * Provides canonical data structures and processing functions for all meal entry flows:
 * - Barcode scanning
 * - Photo analysis
 * - Text description
 * - Recipe import
 */

// ============================================================================
// Types
// ============================================================================

export type SourceType = 'barcode' | 'photo' | 'description' | 'recipe' | 'manual';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SourceMetadata {
  /** The method used to obtain nutrition data */
  method: 'verified' | 'estimate';
  /** Source of the data (e.g., 'usda', 'openfoodfacts', 'ai_estimate') */
  source?: string;
  /** Model or extractor used for estimation */
  model?: string;
  /** Raw output from the extractor/model */
  rawOutput?: unknown;
  /** Barcode if applicable */
  barcode?: string;
  /** Any additional notes from the source */
  notes?: string;
}

export interface MealEntry {
  /** Display name of the meal/food */
  name: string;
  /** Calories - null if unknown, not 0 */
  calories: number | null;
  /** Protein in grams - null if unknown */
  protein: number | null;
  /** Carbohydrates in grams - null if unknown */
  carbs: number | null;
  /** Fats in grams - null if unknown */
  fats: number | null;
  /** Image URL if available */
  imageUrl?: string | null;
  /** How the entry was created */
  sourceType: SourceType;
  /** Confidence in the nutrition data */
  confidence: ConfidenceLevel;
  /** Metadata about how nutrition was obtained */
  sourceMetadata?: SourceMetadata;
  /** Serving size in grams if known */
  servingGrams?: number | null;
}

export interface NutritionResult {
  /** Final calories value (may be derived) */
  calories: number | null;
  /** Protein in grams */
  protein: number | null;
  /** Carbohydrates in grams */
  carbs: number | null;
  /** Fats in grams */
  fats: number | null;
  /** Whether calories were derived from macros */
  caloriesDerived: boolean;
  /** Confidence level in the result */
  confidence: ConfidenceLevel;
  /** Display values (rounded for UI) */
  display: {
    calories: string;
    protein: string;
    carbs: string;
    fats: string;
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// Input types from various sources
export interface BarcodeInput {
  barcode: string;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  servingSize?: number;
  source?: string;
  verified?: boolean;
}

export interface PhotoAnalysisInput {
  name: string;
  ingredients?: Array<{
    name: string;
    estimatedGrams: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  }>;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFats?: number;
  confidence?: string;
  notes?: string;
  model?: string;
}

export interface DescriptionInput {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  confidence?: string;
  notes?: string;
  model?: string;
}

export interface RecipeInput {
  name: string;
  servings?: number;
  ingredients?: Array<{
    name: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  }>;
  totals?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  confidence?: string;
  notes?: string;
}

export interface ManualInput {
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export type NutritionInput = 
  | BarcodeInput 
  | PhotoAnalysisInput 
  | DescriptionInput 
  | RecipeInput 
  | ManualInput;

// ============================================================================
// Constants
// ============================================================================

/** Caloric values per gram of macronutrient */
const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fats: 9,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a value to null if it's undefined, NaN, or explicitly missing
 */
function toNullable(value: number | undefined | null): number | null {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return null;
  }
  return value;
}

/**
 * Maps confidence string from API responses to ConfidenceLevel
 */
function parseConfidence(confidence?: string): ConfidenceLevel {
  if (!confidence) return 'medium';
  const lower = confidence.toLowerCase();
  if (lower === 'high' || lower === 'verified') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

/**
 * Rounds a number for display purposes
 */
function roundForDisplay(value: number | null): string {
  if (value === null) return '-';
  return Math.round(value).toString();
}

/**
 * Derives calories from macros using 4/4/9 rule
 */
function deriveCaloriesFromMacros(
  protein: number | null,
  carbs: number | null,
  fats: number | null
): number | null {
  // Need at least one macro to derive
  if (protein === null && carbs === null && fats === null) {
    return null;
  }
  
  const proteinCals = (protein ?? 0) * CALORIES_PER_GRAM.protein;
  const carbsCals = (carbs ?? 0) * CALORIES_PER_GRAM.carbs;
  const fatsCals = (fats ?? 0) * CALORIES_PER_GRAM.fats;
  
  return proteinCals + carbsCals + fatsCals;
}

// ============================================================================
// Main Pipeline Functions
// ============================================================================

/**
 * Normalizes input from various sources into a canonical MealEntry shape
 */
export function normalizeToCanonicalMealEntry(
  input: NutritionInput,
  sourceType: SourceType
): MealEntry {
  switch (sourceType) {
    case 'barcode': {
      const barcodeInput = input as BarcodeInput;
      return {
        name: barcodeInput.name,
        calories: toNullable(barcodeInput.calories),
        protein: toNullable(barcodeInput.protein),
        carbs: toNullable(barcodeInput.carbs),
        fats: toNullable(barcodeInput.fats),
        sourceType: 'barcode',
        confidence: barcodeInput.verified ? 'high' : 'medium',
        servingGrams: toNullable(barcodeInput.servingSize),
        sourceMetadata: {
          method: barcodeInput.verified ? 'verified' : 'estimate',
          source: barcodeInput.source,
          barcode: barcodeInput.barcode,
        },
      };
    }

    case 'photo': {
      const photoInput = input as PhotoAnalysisInput;
      return {
        name: photoInput.name,
        calories: toNullable(photoInput.totalCalories),
        protein: toNullable(photoInput.totalProtein),
        carbs: toNullable(photoInput.totalCarbs),
        fats: toNullable(photoInput.totalFats),
        sourceType: 'photo',
        confidence: parseConfidence(photoInput.confidence),
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimate',
          model: photoInput.model,
          notes: photoInput.notes,
          rawOutput: photoInput.ingredients,
        },
      };
    }

    case 'description': {
      const descInput = input as DescriptionInput;
      return {
        name: descInput.name,
        calories: toNullable(descInput.calories),
        protein: toNullable(descInput.protein),
        carbs: toNullable(descInput.carbs),
        fats: toNullable(descInput.fats),
        sourceType: 'description',
        confidence: parseConfidence(descInput.confidence),
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimate',
          model: descInput.model,
          notes: descInput.notes,
        },
      };
    }

    case 'recipe': {
      const recipeInput = input as RecipeInput;
      const totals = recipeInput.totals || {};
      return {
        name: recipeInput.name,
        calories: toNullable(totals.calories),
        protein: toNullable(totals.protein),
        carbs: toNullable(totals.carbs),
        fats: toNullable(totals.fats),
        sourceType: 'recipe',
        confidence: parseConfidence(recipeInput.confidence),
        sourceMetadata: {
          method: 'estimate',
          source: 'recipe_import',
          notes: recipeInput.notes,
          rawOutput: recipeInput.ingredients,
        },
      };
    }

    case 'manual':
    default: {
      const manualInput = input as ManualInput;
      return {
        name: manualInput.name,
        calories: toNullable(manualInput.calories),
        protein: toNullable(manualInput.protein),
        carbs: toNullable(manualInput.carbs),
        fats: toNullable(manualInput.fats),
        sourceType: 'manual',
        confidence: 'high', // User-entered values are authoritative
        sourceMetadata: {
          method: 'verified',
          source: 'user_input',
        },
      };
    }
  }
}

/**
 * Computes final nutrition values with derivation logic
 * 
 * Rules:
 * - Barcode verified nutrition takes precedence (confidence: high)
 * - Photo/description estimates store method="estimate" with source_metadata
 * - If calories missing but macros present: derive via 4/4/9, mark derived=true
 * - Missing values are null, not 0
 */
export function computeNutrition(mealEntry: MealEntry): NutritionResult {
  let { calories, protein, carbs, fats, confidence } = mealEntry;
  let caloriesDerived = false;

  // If calories missing but we have macros, derive using 4/4/9 rule
  if (calories === null && (protein !== null || carbs !== null || fats !== null)) {
    calories = deriveCaloriesFromMacros(protein, carbs, fats);
    caloriesDerived = calories !== null;
  }

  // Barcode with verified data gets high confidence
  if (mealEntry.sourceType === 'barcode' && mealEntry.sourceMetadata?.method === 'verified') {
    confidence = 'high';
  }

  // Derived calories reduce confidence if it was high
  if (caloriesDerived && confidence === 'high') {
    confidence = 'medium';
  }

  return {
    calories,
    protein,
    carbs,
    fats,
    caloriesDerived,
    confidence,
    display: {
      calories: roundForDisplay(calories),
      protein: roundForDisplay(protein),
      carbs: roundForDisplay(carbs),
      fats: roundForDisplay(fats),
    },
  };
}

/**
 * Validates a MealEntry for completeness and correctness
 */
export function validateMealEntry(mealEntry: MealEntry): ValidationResult {
  const errors: string[] = [];

  // Name is required
  if (!mealEntry.name || mealEntry.name.trim().length === 0) {
    errors.push('Name is required');
  }

  // Source type must be valid
  const validSourceTypes: SourceType[] = ['barcode', 'photo', 'description', 'recipe', 'manual'];
  if (!validSourceTypes.includes(mealEntry.sourceType)) {
    errors.push(`Invalid source type: ${mealEntry.sourceType}`);
  }

  // Numeric values must be non-negative if present
  if (mealEntry.calories !== null && mealEntry.calories < 0) {
    errors.push('Calories cannot be negative');
  }
  if (mealEntry.protein !== null && mealEntry.protein < 0) {
    errors.push('Protein cannot be negative');
  }
  if (mealEntry.carbs !== null && mealEntry.carbs < 0) {
    errors.push('Carbs cannot be negative');
  }
  if (mealEntry.fats !== null && mealEntry.fats < 0) {
    errors.push('Fats cannot be negative');
  }

  // Confidence must be valid
  const validConfidence: ConfidenceLevel[] = ['high', 'medium', 'low'];
  if (!validConfidence.includes(mealEntry.confidence)) {
    errors.push(`Invalid confidence level: ${mealEntry.confidence}`);
  }

  // Warn if all nutrition values are null (not an error, but worth noting)
  const hasAnyNutrition = 
    mealEntry.calories !== null || 
    mealEntry.protein !== null || 
    mealEntry.carbs !== null || 
    mealEntry.fats !== null;
  
  if (!hasAnyNutrition) {
    errors.push('No nutrition data provided');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export { deriveCaloriesFromMacros, roundForDisplay, toNullable, parseConfidence };
