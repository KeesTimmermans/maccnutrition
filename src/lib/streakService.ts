import { supabase } from "@/integrations/supabase/client";

export type StreakType = 'login' | 'coaching';

export interface UserStreak {
  id: string;
  user_id: string;
  streak_type: StreakType;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

export const getStreaks = async (): Promise<UserStreak[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching streaks:', error);
    return [];
  }

  return (data || []) as UserStreak[];
};

export const updateStreak = async (streakType: StreakType): Promise<UserStreak | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Get existing streak
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', user.id)
    .eq('streak_type', streakType)
    .maybeSingle();

  if (!existing) {
    // Create new streak
    const { data, error } = await supabase
      .from('user_streaks')
      .insert({
        user_id: user.id,
        streak_type: streakType,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating streak:', error);
      return null;
    }
    return data as UserStreak;
  }

  // Already logged today
  if (existing.last_activity_date === today) {
    return existing as UserStreak;
  }

  // Calculate new streak
  let newStreak = 1;
  if (existing.last_activity_date === yesterday) {
    newStreak = existing.current_streak + 1;
  }

  const newLongest = Math.max(newStreak, existing.longest_streak);

  const { data, error } = await supabase
    .from('user_streaks')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_activity_date: today,
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating streak:', error);
    return null;
  }

  return data as UserStreak;
};
