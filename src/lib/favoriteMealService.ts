import { supabase } from "@/integrations/supabase/client";

export interface FavoriteMeal {
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients?: string | null;
  created_at: string;
}

export interface FavoriteMealInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients?: string;
}

export const saveFavoriteMeal = async (meal: FavoriteMealInput): Promise<FavoriteMeal | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("favorite_meals")
    .insert({
      user_id: user.id,
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fats: meal.fats,
      ingredients: meal.ingredients || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving favorite meal:", error);
    throw error;
  }

  return data;
};

export const getFavoriteMeals = async (): Promise<FavoriteMeal[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("favorite_meals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching favorite meals:", error);
    return [];
  }

  return data || [];
};

export const deleteFavoriteMeal = async (mealId: string): Promise<void> => {
  const { error } = await supabase
    .from("favorite_meals")
    .delete()
    .eq("id", mealId);

  if (error) {
    console.error("Error deleting favorite meal:", error);
    throw error;
  }
};
