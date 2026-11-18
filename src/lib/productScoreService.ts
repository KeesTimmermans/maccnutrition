import { supabase } from "@/integrations/supabase/client";
import type { ProductScoreInput } from "@/lib/foodScore";

export interface ProductLookup {
  found: boolean;
  code?: string | null;
  product_name?: string | null;
  product_name_en?: string | null;
  brands?: string | null;
  image_url?: string | null;
  ingredients_text?: string | null;
  ingredients_text_en?: string | null;
  ingredients_n?: number | null;
  additives_tags?: string[] | null;
  nova_group?: number | null;
  nutriscore_grade?: string | null;
  categories_tags?: string[] | null;
  stores_tags?: string[] | null;
  fruits_vegetables_nuts_100g?: number | null;
  nutriments?: {
    sugars_100g: number | null;
    saturated_fat_100g: number | null;
    salt_100g: number | null;
    fiber_100g: number | null;
    proteins_100g: number | null;
  };
}

export const isValidBarcode = (value: string) => /^\d{8,14}$/.test(value);

/** Looks up a product's raw data for Scan & rate. Throws on network/server errors. */
export async function lookupProductForScore(barcode: string): Promise<ProductLookup> {
  const { data, error } = await supabase.functions.invoke<ProductLookup>("product-score", {
    body: { barcode },
  });
  if (error) throw error;
  return data ?? { found: false };
}

export function toScoreInput(p: ProductLookup): ProductScoreInput {
  return {
    sugars100g: p.nutriments?.sugars_100g ?? null,
    saturatedFat100g: p.nutriments?.saturated_fat_100g ?? null,
    salt100g: p.nutriments?.salt_100g ?? null,
    fiber100g: p.nutriments?.fiber_100g ?? null,
    proteins100g: p.nutriments?.proteins_100g ?? null,
    fruitVegNuts100g: p.fruits_vegetables_nuts_100g ?? null,
    ingredientsText: p.ingredients_text_en || p.ingredients_text || null,
    novaGroup: p.nova_group ?? null,
    additivesTags: p.additives_tags ?? null,
    categoriesTags: p.categories_tags ?? null,
  };
}

export function productDisplayName(p: ProductLookup): string | null {
  return p.product_name_en || p.product_name || null;
}

/** First listed brand, or null when it just repeats the product name. */
export function productBrand(p: ProductLookup): string | null {
  const brand = p.brands?.split(",")[0]?.trim();
  const name = productDisplayName(p);
  if (!brand) return null;
  return name && name.toLowerCase().includes(brand.toLowerCase()) ? null : brand;
}
