import { supabase } from "@/integrations/supabase/client";
import { triggerMealReinforcement } from "./reinforcementService";

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  image_url?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  logged_at: string;
  created_at: string;
}

export interface MealInput {
  name: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar?: number;
  notes?: string;
}

export const saveMeal = async (meal: MealInput, loggedAt?: Date): Promise<Meal | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("meals")
    .insert({
      user_id: user.id,
      name: meal.name,
      image_url: meal.imageUrl || null,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
      sugar: meal.sugar || 0,
      notes: meal.notes || null,
      logged_at: loggedAt ? loggedAt.toISOString() : new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Error saving meal:", error);
    throw error;
  }

  // Trigger reinforcement after successful save
  if (data) {
    const mealName = data.name.toLowerCase();
    const mealType = mealName.includes('breakfast') ? 'breakfast' 
      : mealName.includes('lunch') ? 'lunch' 
      : mealName.includes('dinner') ? 'dinner' 
      : undefined;
    triggerMealReinforcement({ mealType });
  }

  return data;
};

export const getTodaysMeals = async (): Promise<Meal[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  // Get start of today in user's local timezone
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .gte("logged_at", today.toISOString())
    .order("logged_at", { ascending: true });

  if (error) {
    console.error("Error fetching meals:", error);
    return [];
  }

  return data || [];
};

export const getMealsByDateRange = async (startDate: Date, endDate: Date): Promise<Meal[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .gte("logged_at", startDate.toISOString())
    .lte("logged_at", endDate.toISOString())
    .order("logged_at", { ascending: false });

  if (error) {
    console.error("Error fetching meals:", error);
    return [];
  }

  return data || [];
};

export const getRecentUniqueMeals = async (days: number = 5): Promise<Meal[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .gte("logged_at", startDate.toISOString())
    .lt("logged_at", today.toISOString())
    .order("logged_at", { ascending: false });

  if (error) {
    console.error("Error fetching recent meals:", error);
    return [];
  }

  // Get unique meals by name (keep the most recent occurrence)
  const uniqueMealsMap = new Map<string, Meal>();
  for (const meal of data || []) {
    const normalizedName = meal.name.toLowerCase().trim();
    if (!uniqueMealsMap.has(normalizedName)) {
      uniqueMealsMap.set(normalizedName, meal);
    }
  }

  return Array.from(uniqueMealsMap.values()).slice(0, 10);
};

export interface FoodSuggestion {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  defaultServingSize?: number;
}

export interface ParsedIngredient {
  name: string;
  estimatedGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
}

export interface ParsedMealResult {
  mealName: string;
  ingredients: ParsedIngredient[];
  confidence: string;
  notes: string;
}

export interface UserDietContext {
  dietType?: string;
  allergies?: string[];
  foodDislikes?: string;
}

export const analyzeFoodImage = async (imageBase64: string, userDietContext?: UserDietContext): Promise<ParsedMealResult> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { imageBase64, userDietContext },
  });

  if (error) {
    console.error("Error analyzing food:", error);
    throw error;
  }

  return data;
};

export const parseMealDescription = async (description: string, userDietContext?: UserDietContext): Promise<ParsedMealResult> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery: description, mode: 'parse_meal', userDietContext },
  });

  if (error) {
    console.error("Error parsing meal:", error);
    throw error;
  }

  return data;
};

export const searchFoodSuggestions = async (query: string): Promise<FoodSuggestion[]> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery: query, mode: 'suggestions' },
  });

  if (error) {
    console.error("Error searching foods:", error);
    throw error;
  }

  return data.suggestions || [];
};

export const getFoodNutritionByWeight = async (
  foodName: string, 
  grams: number
): Promise<{
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: string;
  notes: string;
}> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery: `${grams}g of ${foodName}`, mode: 'calculate' },
  });

  if (error) {
    console.error("Error calculating nutrition:", error);
    throw error;
  }

  return data;
};

export const analyzeFoodSearch = async (searchQuery: string, mode?: 'barcode' | 'analyze'): Promise<{
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: string;
  notes: string;
  source?: string;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatsPer100g?: number;
  defaultServingSize?: number;
}> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery, mode },
  });

  if (error) {
    console.error("Error analyzing food:", error);
    throw error;
  }

  return data;
};

export const updateMeal = async (
  mealId: string,
  updates: Partial<MealInput>
): Promise<Meal | null> => {
  const { data, error } = await supabase
    .from("meals")
    .update({
      name: updates.name,
      calories: updates.calories,
      protein: updates.protein,
      carbs: updates.carbs,
      fats: updates.fats,
      sugar: updates.sugar,
    })
    .eq("id", mealId)
    .select()
    .single();

  if (error) {
    console.error("Error updating meal:", error);
    throw error;
  }

  return data;
};

export const deleteMeal = async (mealId: string): Promise<void> => {
  const { error } = await supabase
    .from("meals")
    .delete()
    .eq("id", mealId);

  if (error) {
    console.error("Error deleting meal:", error);
    throw error;
  }
};
