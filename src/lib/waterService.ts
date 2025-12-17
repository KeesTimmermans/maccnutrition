import { supabase } from "@/integrations/supabase/client";

export interface WaterIntake {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
}

export const getTodaysWaterIntake = async (): Promise<WaterIntake[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('water_intake')
    .select('*')
    .eq('user_id', user.id)
    .gte('logged_at', today.toISOString())
    .order('logged_at', { ascending: true });

  if (error) {
    console.error('Error fetching water intake:', error);
    return [];
  }

  return (data || []) as WaterIntake[];
};

export const addWaterIntake = async (amountMl: number): Promise<WaterIntake | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('water_intake')
    .insert({
      user_id: user.id,
      amount_ml: amountMl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding water intake:', error);
    return null;
  }

  return data as WaterIntake;
};

export const removeLastWaterIntake = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the most recent entry from today
  const { data: entries } = await supabase
    .from('water_intake')
    .select('id')
    .eq('user_id', user.id)
    .gte('logged_at', today.toISOString())
    .order('logged_at', { ascending: false })
    .limit(1);

  if (!entries || entries.length === 0) return false;

  const { error } = await supabase
    .from('water_intake')
    .delete()
    .eq('id', entries[0].id);

  if (error) {
    console.error('Error removing water intake:', error);
    return false;
  }

  return true;
};
