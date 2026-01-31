import { describe, it, expect } from 'vitest';
import {
  normalizeToCanonicalMealEntry,
  computeNutrition,
  validateMealEntry,
  deriveCaloriesFromMacros,
  toNullable,
  type BarcodeInput,
  type PhotoAnalysisInput,
  type DescriptionInput,
  type ManualInput,
  type MealEntry,
} from './nutritionPipeline';

describe('nutritionPipeline', () => {
  // =========================================================================
  // Test 1: Missing macros should be null, not 0
  // =========================================================================
  describe('missing macros handling', () => {
    it('should set missing macros to null, not 0', () => {
      const input: ManualInput = {
        name: 'Apple',
        calories: 95,
        // protein, carbs, fats not provided
      };

      const entry = normalizeToCanonicalMealEntry(input, 'manual');

      expect(entry.calories).toBe(95);
      expect(entry.protein).toBeNull();
      expect(entry.carbs).toBeNull();
      expect(entry.fats).toBeNull();
    });

    it('should handle undefined values as null', () => {
      const input: ManualInput = {
        name: 'Test Food',
        calories: undefined,
        protein: undefined,
        carbs: undefined,
        fats: undefined,
      };

      const entry = normalizeToCanonicalMealEntry(input, 'manual');

      expect(entry.calories).toBeNull();
      expect(entry.protein).toBeNull();
      expect(entry.carbs).toBeNull();
      expect(entry.fats).toBeNull();
    });

    it('should handle NaN values as null via toNullable', () => {
      expect(toNullable(NaN)).toBeNull();
      expect(toNullable(undefined)).toBeNull();
      expect(toNullable(null)).toBeNull();
      expect(toNullable(0)).toBe(0);
      expect(toNullable(100)).toBe(100);
    });
  });

  // =========================================================================
  // Test 2: Derived calories using 4/4/9 rule
  // =========================================================================
  describe('derived calories', () => {
    it('should derive calories from macros when calories missing', () => {
      const entry: MealEntry = {
        name: 'Test Food',
        calories: null,
        protein: 10, // 10 * 4 = 40
        carbs: 20,   // 20 * 4 = 80
        fats: 5,     // 5 * 9 = 45
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = computeNutrition(entry);

      expect(result.calories).toBe(165); // 40 + 80 + 45
      expect(result.caloriesDerived).toBe(true);
    });

    it('should not derive if calories already present', () => {
      const entry: MealEntry = {
        name: 'Test Food',
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 5,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = computeNutrition(entry);

      expect(result.calories).toBe(200);
      expect(result.caloriesDerived).toBe(false);
    });

    it('should derive with partial macros (missing treated as 0)', () => {
      const entry: MealEntry = {
        name: 'Protein Only',
        calories: null,
        protein: 25,  // 25 * 4 = 100
        carbs: null,
        fats: null,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = computeNutrition(entry);

      expect(result.calories).toBe(100);
      expect(result.caloriesDerived).toBe(true);
    });

    it('should return null if no macros available', () => {
      const entry: MealEntry = {
        name: 'Unknown Food',
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        sourceType: 'manual',
        confidence: 'medium',
      };

      const result = computeNutrition(entry);

      expect(result.calories).toBeNull();
      expect(result.caloriesDerived).toBe(false);
    });

    it('should calculate correctly via deriveCaloriesFromMacros helper', () => {
      expect(deriveCaloriesFromMacros(10, 20, 5)).toBe(165);
      expect(deriveCaloriesFromMacros(0, 0, 0)).toBe(0);
      expect(deriveCaloriesFromMacros(null, null, null)).toBeNull();
      expect(deriveCaloriesFromMacros(25, null, null)).toBe(100);
    });
  });

  // =========================================================================
  // Test 3: Rounding display vs stored precision
  // =========================================================================
  describe('rounding display vs stored precision', () => {
    it('should store full precision but round for display', () => {
      const entry: MealEntry = {
        name: 'Precise Food',
        calories: 123.456,
        protein: 15.789,
        carbs: 22.123,
        fats: 8.567,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = computeNutrition(entry);

      // Stored values maintain precision
      expect(result.calories).toBe(123.456);
      expect(result.protein).toBe(15.789);
      expect(result.carbs).toBe(22.123);
      expect(result.fats).toBe(8.567);

      // Display values are rounded
      expect(result.display.calories).toBe('123');
      expect(result.display.protein).toBe('16');
      expect(result.display.carbs).toBe('22');
      expect(result.display.fats).toBe('9');
    });

    it('should display "-" for null values', () => {
      const entry: MealEntry = {
        name: 'Partial Food',
        calories: 100,
        protein: null,
        carbs: null,
        fats: null,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = computeNutrition(entry);

      expect(result.display.calories).toBe('100');
      expect(result.display.protein).toBe('-');
      expect(result.display.carbs).toBe('-');
      expect(result.display.fats).toBe('-');
    });
  });

  // =========================================================================
  // Test 4: Barcode vs estimate precedence
  // =========================================================================
  describe('barcode vs estimate precedence', () => {
    it('should set high confidence for verified barcode data', () => {
      const input: BarcodeInput = {
        barcode: '1234567890123',
        name: 'Verified Product',
        calories: 250,
        protein: 10,
        carbs: 30,
        fats: 12,
        verified: true,
        source: 'openfoodfacts',
      };

      const entry = normalizeToCanonicalMealEntry(input, 'barcode');
      const result = computeNutrition(entry);

      expect(entry.confidence).toBe('high');
      expect(entry.sourceMetadata?.method).toBe('verified');
      expect(entry.sourceMetadata?.barcode).toBe('1234567890123');
      expect(result.confidence).toBe('high');
    });

    it('should set medium confidence for unverified barcode data', () => {
      const input: BarcodeInput = {
        barcode: '9876543210987',
        name: 'Unverified Product',
        calories: 180,
        verified: false,
      };

      const entry = normalizeToCanonicalMealEntry(input, 'barcode');

      expect(entry.confidence).toBe('medium');
      expect(entry.sourceMetadata?.method).toBe('estimate');
    });

    it('should set estimate method for photo analysis', () => {
      const input: PhotoAnalysisInput = {
        name: 'Chicken Salad',
        totalCalories: 350,
        totalProtein: 30,
        totalCarbs: 15,
        totalFats: 18,
        confidence: 'medium',
        model: 'gemini-2.5-flash',
        notes: 'Estimated from photo',
      };

      const entry = normalizeToCanonicalMealEntry(input, 'photo');

      expect(entry.sourceMetadata?.method).toBe('estimate');
      expect(entry.sourceMetadata?.source).toBe('ai_estimate');
      expect(entry.sourceMetadata?.model).toBe('gemini-2.5-flash');
      expect(entry.confidence).toBe('medium');
    });

    it('should set estimate method for description input', () => {
      const input: DescriptionInput = {
        name: 'Grilled chicken breast',
        calories: 165,
        protein: 31,
        carbs: 0,
        fats: 3.6,
        confidence: 'high',
        model: 'gemini-2.5-flash',
      };

      const entry = normalizeToCanonicalMealEntry(input, 'description');

      expect(entry.sourceMetadata?.method).toBe('estimate');
      expect(entry.sourceMetadata?.source).toBe('ai_estimate');
      expect(entry.confidence).toBe('high');
    });

    it('should reduce confidence when calories are derived', () => {
      const entry: MealEntry = {
        name: 'Derived Calories Food',
        calories: null,
        protein: 20,
        carbs: 30,
        fats: 10,
        sourceType: 'barcode',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          barcode: '1234567890123',
        },
      };

      const result = computeNutrition(entry);

      // Even verified barcode, if calories derived, confidence drops
      expect(result.caloriesDerived).toBe(true);
      expect(result.confidence).toBe('medium');
    });
  });

  // =========================================================================
  // Test 5: Validation
  // =========================================================================
  describe('validateMealEntry', () => {
    it('should pass for valid complete entry', () => {
      const entry: MealEntry = {
        name: 'Valid Food',
        calories: 200,
        protein: 15,
        carbs: 20,
        fats: 8,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = validateMealEntry(entry);

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing name', () => {
      const entry: MealEntry = {
        name: '',
        calories: 200,
        protein: 15,
        carbs: 20,
        fats: 8,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = validateMealEntry(entry);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail for negative values', () => {
      const entry: MealEntry = {
        name: 'Bad Food',
        calories: -100,
        protein: -5,
        carbs: 20,
        fats: 8,
        sourceType: 'manual',
        confidence: 'high',
      };

      const result = validateMealEntry(entry);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('Calories cannot be negative');
      expect(result.errors).toContain('Protein cannot be negative');
    });

    it('should fail for entry with no nutrition data', () => {
      const entry: MealEntry = {
        name: 'No Nutrition',
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        sourceType: 'manual',
        confidence: 'medium',
      };

      const result = validateMealEntry(entry);

      expect(result.ok).toBe(false);
      expect(result.errors).toContain('No nutrition data provided');
    });
  });

  // =========================================================================
  // Test 6: Source type normalization
  // =========================================================================
  describe('source type normalization', () => {
    it('should correctly normalize recipe input', () => {
      const input = {
        name: 'Pasta Primavera',
        servings: 4,
        ingredients: [
          { name: 'Pasta', calories: 400 },
          { name: 'Vegetables', calories: 100 },
        ],
        totals: {
          calories: 500,
          protein: 20,
          carbs: 70,
          fats: 15,
        },
        confidence: 'medium',
      };

      const entry = normalizeToCanonicalMealEntry(input, 'recipe');

      expect(entry.name).toBe('Pasta Primavera');
      expect(entry.calories).toBe(500);
      expect(entry.sourceType).toBe('recipe');
      expect(entry.sourceMetadata?.method).toBe('estimate');
      expect(entry.sourceMetadata?.source).toBe('recipe_import');
      expect(entry.sourceMetadata?.rawOutput).toEqual(input.ingredients);
    });

    it('should set manual entries as verified with high confidence', () => {
      const input: ManualInput = {
        name: 'User Entered Food',
        calories: 300,
        protein: 25,
        carbs: 35,
        fats: 10,
      };

      const entry = normalizeToCanonicalMealEntry(input, 'manual');

      expect(entry.confidence).toBe('high');
      expect(entry.sourceMetadata?.method).toBe('verified');
      expect(entry.sourceMetadata?.source).toBe('user_input');
    });
  });
});
