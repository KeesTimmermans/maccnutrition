import { describe, it, expect } from 'vitest';
import {
  computeNutrition,
  normalizeToCanonicalMealEntry,
  SOURCE_RANK,
  type MealEntry,
  type SourceMetadata,
} from './nutritionPipeline';

describe('Nutrition Pipeline - Provenance Tracking', () => {
  describe('computeNutrition source detection', () => {
    it('marks barcode scans as barcode_verified with high confidence', () => {
      const entry: MealEntry = {
        name: 'Test Product',
        calories: 200,
        protein: 20,
        carbs: 10,
        fats: 8,
        sourceType: 'barcode',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'open_food_facts',
          barcode: '1234567890',
        },
      };

      const result = computeNutrition(entry);
      
      expect(result.nutritionSource).toBe('barcode_verified');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.9);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('marks AI estimates as estimate with low confidence', () => {
      const entry: MealEntry = {
        name: 'Unknown Meal',
        calories: 300,
        protein: 15,
        carbs: 30,
        fats: 12,
        sourceType: 'description',
        confidence: 'low',
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimation',
        },
      };

      const result = computeNutrition(entry);
      
      expect(result.nutritionSource).toBe('estimate');
      expect(result.confidenceScore).toBeLessThan(0.7);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('marks USDA database results as database_generic', () => {
      const entry: MealEntry = {
        name: 'Chicken Breast',
        calories: 165,
        protein: 31,
        carbs: 0,
        fats: 3.6,
        sourceType: 'description',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'usda',
          sourceCategory: 'generic_db',
        },
      };

      const result = computeNutrition(entry);
      
      expect(result.nutritionSource).toBe('database_generic');
      expect(result.sourceRank).toBe(SOURCE_RANK.GENERIC_DB);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('marks manual entries as verified with high confidence', () => {
      const entry: MealEntry = {
        name: 'My Custom Meal',
        calories: 500,
        protein: 30,
        carbs: 40,
        fats: 20,
        sourceType: 'manual',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'user_input',
        },
      };

      const result = computeNutrition(entry);
      
      expect(result.confidenceScore).toBe(1);
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  describe('source rank selection', () => {
    it('ranks verified barcode highest', () => {
      const entry: MealEntry = {
        name: 'Barcode Product',
        calories: 200,
        protein: 10,
        carbs: 20,
        fats: 5,
        sourceType: 'barcode',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          barcode: '123',
        },
      };

      const result = computeNutrition(entry);
      expect(result.sourceRank).toBe(SOURCE_RANK.VERIFIED_BARCODE);
    });

    it('ranks AI estimates lowest', () => {
      const entry: MealEntry = {
        name: 'AI Estimated Meal',
        calories: 300,
        protein: 20,
        carbs: 30,
        fats: 10,
        sourceType: 'photo',
        confidence: 'medium',
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimation',
        },
      };

      const result = computeNutrition(entry);
      expect(result.sourceRank).toBe(SOURCE_RANK.ESTIMATE);
    });
  });

  describe('confirmation requirement', () => {
    it('requires confirmation for low confidence estimates', () => {
      const entry: MealEntry = {
        name: 'Uncertain Meal',
        calories: 400,
        protein: 25,
        carbs: 35,
        fats: 15,
        sourceType: 'description',
        confidence: 'low',
        sourceMetadata: {
          method: 'estimate',
          source: 'ai_estimation',
          confidenceScore: 0.4,
        },
      };

      const result = computeNutrition(entry);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('does not require confirmation for verified sources', () => {
      const entry: MealEntry = {
        name: 'Verified Product',
        calories: 150,
        protein: 12,
        carbs: 18,
        fats: 4,
        sourceType: 'barcode',
        confidence: 'high',
        sourceMetadata: {
          method: 'verified',
          source: 'open_food_facts',
        },
      };

      const result = computeNutrition(entry);
      expect(result.requiresConfirmation).toBe(false);
    });
  });
});
