import { describe, it, expect } from 'vitest';
import { getNutritionSourceLabel } from './brandDetection';
import {
  computeNutrition,
  type MealEntry,
  SOURCE_RANK,
} from './nutritionPipeline';

describe('UK Food Database Integration', () => {
  describe('Source labeling', () => {
    it('labels OpenFoodFacts source correctly', () => {
      expect(getNutritionSourceLabel('openfoodfacts')).toBe('✓ OpenFoodFacts');
      expect(getNutritionSourceLabel('open_food_facts')).toBe('✓ OpenFoodFacts');
    });

    it('labels FoodRepo source correctly', () => {
      expect(getNutritionSourceLabel('foodrepo')).toBe('✓ FoodRepo');
    });

    it('labels FatSecret UK source correctly', () => {
      expect(getNutritionSourceLabel('fatsecret')).toBe('✓ FatSecret');
      expect(getNutritionSourceLabel('fatsecret_uk')).toBe('✓ FatSecret (UK)');
    });

    it('labels estimate source correctly', () => {
      expect(getNutritionSourceLabel('estimate')).toBe('⚡ Estimate');
      expect(getNutritionSourceLabel('ai_estimation')).toBe('⚡ Estimate');
    });

    it('labels USDA source correctly', () => {
      expect(getNutritionSourceLabel('usda')).toBe('USDA');
    });

    it('handles fallback for unknown sources containing keywords', () => {
      expect(getNutritionSourceLabel('custom_openfoodfacts_v2')).toBe('✓ OpenFoodFacts');
      expect(getNutritionSourceLabel('custom_foodrepo_eu')).toBe('✓ FoodRepo');
      expect(getNutritionSourceLabel('fatsecret_branded')).toBe('✓ FatSecret');
    });
  });

  describe('Pipeline provenance for UK/EU sources', () => {
    it('marks OFF results as database_generic with high confidence', () => {
      const entry: MealEntry = {
        name: 'Greggs Sausage Roll',
        calories: 327,
        protein: 8,
        carbs: 26,
        fats: 22,
        sourceType: 'description',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'openfoodfacts',
          sourceCategory: 'branded_db',
          brandName: 'Greggs',
        },
      };

      const result = computeNutrition(entry);
      expect(result.sourceRank).toBe(SOURCE_RANK.BRANDED_DB);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('marks FoodRepo results as database_generic', () => {
      const entry: MealEntry = {
        name: 'Emmi Caffè Latte',
        calories: 70,
        protein: 3,
        carbs: 9,
        fats: 2,
        sourceType: 'description',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'foodrepo',
          sourceCategory: 'generic_db',
        },
      };

      const result = computeNutrition(entry);
      expect(result.sourceRank).toBe(SOURCE_RANK.GENERIC_DB);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('marks OpenFoodFacts barcode scan as barcode_verified', () => {
      const entry: MealEntry = {
        name: 'Cadbury Dairy Milk',
        calories: 534,
        protein: 7,
        carbs: 57,
        fats: 30,
        sourceType: 'barcode',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'openfoodfacts',
          barcode: '7622210100672',
        },
      };

      const result = computeNutrition(entry);
      expect(result.nutritionSource).toBe('barcode_verified');
      expect(result.sourceRank).toBe(SOURCE_RANK.VERIFIED_BARCODE);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  describe('Fallback behavior', () => {
    it('estimate fallback requires confirmation for low confidence', () => {
      const entry: MealEntry = {
        name: 'Unknown UK Product',
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 8,
        sourceType: 'description',
        confidence: 'low',
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimation',
          confidenceScore: 0.4,
        },
      };

      const result = computeNutrition(entry);
      expect(result.nutritionSource).toBe('estimate');
      expect(result.requiresConfirmation).toBe(true);
      expect(result.sourceRank).toBe(SOURCE_RANK.ESTIMATE);
    });

    it('does not require confirmation when confidence >= 0.7', () => {
      const entry: MealEntry = {
        name: 'Known Product',
        calories: 150,
        protein: 12,
        carbs: 18,
        fats: 4,
        sourceType: 'description',
        confidence: 'medium',
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimation',
          confidenceScore: 0.75,
        },
      };

      const result = computeNutrition(entry);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('derives calories from macros when missing and marks as derived', () => {
      const entry: MealEntry = {
        name: 'UK Product No Calories',
        calories: null,
        protein: 10,
        carbs: 20,
        fats: 5,
        sourceType: 'description',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'openfoodfacts',
        },
      };

      const result = computeNutrition(entry);
      // 4*10 + 4*20 + 9*5 = 40 + 80 + 45 = 165
      expect(result.calories).toBe(165);
      expect(result.caloriesDerived).toBe(true);
    });
  });
});
