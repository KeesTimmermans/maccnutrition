import { describe, it, expect } from 'vitest';
import {
  detectChainRestaurant,
  detectBrandedProduct,
  extractChainAndItem,
  getNutritionSourceLabel,
} from './brandDetection';

describe('Brand Detection', () => {
  describe('detectChainRestaurant', () => {
    it('detects Joe & The Juice', () => {
      const result = detectChainRestaurant('Joe & The Juice Tunacado');
      expect(result.isChain).toBe(true);
      expect(result.chainName).toBe('joe & the juice');
    });

    it('detects Starbucks', () => {
      const result = detectChainRestaurant('Starbucks Caramel Macchiato');
      expect(result.isChain).toBe(true);
      expect(result.chainName).toBe('starbucks');
    });

    it('detects Chipotle', () => {
      const result = detectChainRestaurant('Chipotle burrito bowl');
      expect(result.isChain).toBe(true);
      expect(result.chainName).toBe('chipotle');
    });

    it('detects UK chains like Nandos', () => {
      const result = detectChainRestaurant("Nando's peri peri chicken");
      expect(result.isChain).toBe(true);
      expect(result.chainName).toBe("nando's");
    });

    it('does not detect generic foods', () => {
      const result = detectChainRestaurant('grilled chicken breast');
      expect(result.isChain).toBe(false);
      expect(result.chainName).toBeUndefined();
    });

    it('is case insensitive', () => {
      const result = detectChainRestaurant('MCDONALDS Big Mac');
      expect(result.isChain).toBe(true);
      expect(result.chainName).toBe('mcdonalds');
    });
  });

  describe('detectBrandedProduct', () => {
    it('detects protein bar keyword', () => {
      const result = detectBrandedProduct('Quest protein bar chocolate');
      expect(result.isBranded).toBe(true);
      expect(result.brandKeyword).toBe('protein bar');
    });

    it('detects protein shake keyword', () => {
      const result = detectBrandedProduct('Premier protein shake vanilla');
      expect(result.isBranded).toBe(true);
      expect(result.brandKeyword).toBe('protein shake');
    });

    it('does not detect generic foods', () => {
      const result = detectBrandedProduct('chicken salad');
      expect(result.isBranded).toBe(false);
      expect(result.brandKeyword).toBeUndefined();
    });
  });

  describe('extractChainAndItem', () => {
    it('extracts chain and item from query', () => {
      const result = extractChainAndItem('Joe & The Juice Tunacado');
      expect(result.chain).toBe('joe & the juice');
      expect(result.item).toBe('Tunacado');
    });

    it('handles item before chain name', () => {
      const result = extractChainAndItem('Big Mac from McDonalds');
      expect(result.chain).toBe('mcdonalds');
      expect(result.item).toBe('Big Mac from');
    });

    it('returns original input if no chain detected', () => {
      const result = extractChainAndItem('grilled salmon');
      expect(result.chain).toBeUndefined();
      expect(result.item).toBe('grilled salmon');
    });
  });

  describe('getNutritionSourceLabel', () => {
    it('returns correct label for branded_verified', () => {
      expect(getNutritionSourceLabel('branded_verified')).toBe('✓ Verified');
    });

    it('returns correct label for barcode_verified', () => {
      expect(getNutritionSourceLabel('barcode_verified')).toBe('✓ Barcode');
    });

    it('returns correct label for database_generic', () => {
      expect(getNutritionSourceLabel('database_generic')).toBe('Database');
    });

    it('returns correct label for estimate', () => {
      expect(getNutritionSourceLabel('estimate')).toBe('⚡ Estimate');
    });

    it('returns correct label for open_food_facts', () => {
      expect(getNutritionSourceLabel('open_food_facts')).toBe('✓ Verified');
    });

    it('returns correct label for usda', () => {
      expect(getNutritionSourceLabel('usda')).toBe('USDA');
    });

    it('returns correct label for ai_estimation', () => {
      expect(getNutritionSourceLabel('ai_estimation')).toBe('⚡ Estimate');
    });
  });
});
