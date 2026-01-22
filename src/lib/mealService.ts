import { supabase } from "@/integrations/supabase/client";

export interface Meal {
  id: string;
  user_id: string;
  name: string;
  image_url?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
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
}

export const saveMeal = async (meal: MealInput): Promise<Meal | null> => {
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
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving meal:", error);
    throw error;
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

export const analyzeFoodImage = async (imageBase64: string): Promise<ParsedMealResult> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { imageBase64 },
  });

  if (error) {
    console.error("Error analyzing food:", error);
    throw error;
  }

  return data;
};

export const parseMealDescription = async (description: string): Promise<ParsedMealResult> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery: description, mode: 'parse_meal' },
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

export const analyzeFoodSearch = async (searchQuery: string): Promise<{
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence: string;
  notes: string;
}> => {
  const { data, error } = await supabase.functions.invoke("analyze-food", {
    body: { searchQuery },
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
