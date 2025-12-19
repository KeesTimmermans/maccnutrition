import { supabase } from "@/integrations/supabase/client";

export interface DailyCheckIn {
  id?: string;
  user_id?: string;
  check_in_date: string;
  mood: number;
  energy_level: number;
  sleep_quality: number;
  sleep_hours?: number;
  stress_level: number;
  hydration_feeling?: number;
  hunger_level?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CheckInAnalysis {
  averageMood: number;
  averageEnergy: number;
  averageSleep: number;
  averageStress: number;
  trends: {
    mood: "improving" | "declining" | "stable";
    energy: "improving" | "declining" | "stable";
    sleep: "improving" | "declining" | "stable";
    stress: "improving" | "declining" | "stable";
  };
  recommendations: string[];
}

/**
 * Get today's check-in for the current user
 */
export async function getTodaysCheckIn(): Promise<DailyCheckIn | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('check_in_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today\'s check-in:', error);
    return null;
  }

  return data as DailyCheckIn | null;
}

/**
 * Save or update today's check-in
 */
export async function saveCheckIn(checkIn: Omit<DailyCheckIn, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<DailyCheckIn | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert({
      user_id: user.id,
      check_in_date: checkIn.check_in_date,
      mood: checkIn.mood,
      energy_level: checkIn.energy_level,
      sleep_quality: checkIn.sleep_quality,
      sleep_hours: checkIn.sleep_hours,
      stress_level: checkIn.stress_level,
      hydration_feeling: checkIn.hydration_feeling,
      hunger_level: checkIn.hunger_level,
      notes: checkIn.notes,
    }, {
      onConflict: 'user_id,check_in_date',
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving check-in:', error);
    throw error;
  }

  return data as DailyCheckIn;
}

/**
 * Get recent check-ins for analysis (last 7 days)
 */
export async function getRecentCheckIns(days: number = 7): Promise<DailyCheckIn[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', user.id)
    .gte('check_in_date', startDate.toISOString().split('T')[0])
    .order('check_in_date', { ascending: false });

  if (error) {
    console.error('Error fetching recent check-ins:', error);
    return [];
  }

  return (data || []) as DailyCheckIn[];
}

export interface UserTargets {
  targetCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatsGrams?: number;
  waterLiters?: number;
  sleepHours?: string;
}

/**
 * Analyze check-in patterns and generate recommendations with specific targets
 */
export function analyzeCheckIns(checkIns: DailyCheckIn[], userTargets?: UserTargets): CheckInAnalysis {
  if (checkIns.length === 0) {
    return {
      averageMood: 0,
      averageEnergy: 0,
      averageSleep: 0,
      averageStress: 0,
      trends: {
        mood: "stable",
        energy: "stable",
        sleep: "stable",
        stress: "stable",
      },
      recommendations: [],
    };
  }

  // Calculate averages
  const sum = checkIns.reduce((acc, c) => ({
    mood: acc.mood + (c.mood || 0),
    energy: acc.energy + (c.energy_level || 0),
    sleep: acc.sleep + (c.sleep_quality || 0),
    stress: acc.stress + (c.stress_level || 0),
    sleepHours: acc.sleepHours + (c.sleep_hours || 0),
  }), { mood: 0, energy: 0, sleep: 0, stress: 0, sleepHours: 0 });

  const count = checkIns.length;
  const averages = {
    mood: sum.mood / count,
    energy: sum.energy / count,
    sleep: sum.sleep / count,
    stress: sum.stress / count,
    sleepHours: sum.sleepHours / count,
  };

  // Calculate trends (compare first half vs second half)
  const midpoint = Math.floor(count / 2);
  const getTrend = (metric: 'mood' | 'energy' | 'sleep' | 'stress'): "improving" | "declining" | "stable" => {
    if (count < 3) return "stable";
    
    const recentHalf = checkIns.slice(0, midpoint);
    const olderHalf = checkIns.slice(midpoint);
    
    const getMetricValue = (c: DailyCheckIn) => {
      if (metric === 'mood') return c.mood || 0;
      if (metric === 'energy') return c.energy_level || 0;
      if (metric === 'sleep') return c.sleep_quality || 0;
      return c.stress_level || 0;
    };
    
    const recentAvg = recentHalf.reduce((s, c) => s + getMetricValue(c), 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((s, c) => s + getMetricValue(c), 0) / olderHalf.length;
    
    const diff = recentAvg - olderAvg;
    // For stress, lower is better, so invert the logic
    if (metric === 'stress') {
      if (diff < -0.3) return "improving";
      if (diff > 0.3) return "declining";
    } else {
      if (diff > 0.3) return "improving";
      if (diff < -0.3) return "declining";
    }
    return "stable";
  };

  const trends = {
    mood: getTrend('mood'),
    energy: getTrend('energy'),
    sleep: getTrend('sleep'),
    stress: getTrend('stress'),
  };

  // Generate specific recommendations based on patterns AND user targets
  const recommendations: string[] = [];
  const protein = userTargets?.proteinGrams || 120;
  const water = userTargets?.waterLiters || 2.5;
  const targetSleep = userTargets?.sleepHours ? parseFloat(userTargets.sleepHours) : 8;

  // Sleep-specific recommendations
  if (averages.sleep < 3) {
    const sleepDeficit = targetSleep - averages.sleepHours;
    if (sleepDeficit > 1) {
      recommendations.push(`Your sleep is ${Math.round(sleepDeficit)}h below target. Aim for bed by 10:30 PM tonight to hit ${targetSleep}h.`);
    } else {
      recommendations.push(`Sleep quality is low (${averages.sleep.toFixed(1)}/5). Try 400mg magnesium with dinner and no screens after 9 PM.`);
    }
  }

  // Energy-specific recommendations
  if (averages.energy < 3) {
    const proteinTarget = Math.round(protein * 0.3); // 30% at breakfast
    recommendations.push(`Energy averaging ${averages.energy.toFixed(1)}/5. Hit ${proteinTarget}g protein at breakfast and drink ${Math.round(water * 0.4)}L water by noon.`);
  }

  // Stress-specific recommendations
  if (averages.stress > 3.5) {
    const carbReduction = Math.round((userTargets?.carbsGrams || 200) * 0.1);
    recommendations.push(`Stress is elevated (${averages.stress.toFixed(1)}/5). Reduce refined carbs by ${carbReduction}g and add 10min walk after lunch.`);
  }

  // Mood + sleep correlation
  if (averages.mood < 3 && averages.sleep < 3) {
    recommendations.push(`Mood (${averages.mood.toFixed(1)}/5) correlates with sleep. Prioritize ${targetSleep}h sleep tonight — mood typically improves within 2-3 days.`);
  }

  // Energy trend declining
  if (trends.energy === "declining") {
    recommendations.push(`Energy trend is down. Increase protein to ${protein}g/day and ensure ${water}L water. Check iron-rich foods if fatigue persists.`);
  }

  // Positive reinforcement for improving stress
  if (trends.stress === "improving") {
    recommendations.push(`Stress is improving! Keep up your current routine — consistency is driving these results.`);
  }

  // Hydration feeling check (if available in recent check-ins)
  const recentHydration = checkIns[0]?.hydration_feeling;
  if (recentHydration && recentHydration < 3) {
    recommendations.push(`Hydration feeling is low. Target ${water}L water today — set reminders for 250ml every 2 hours.`);
  }

  // Hunger level check
  const recentHunger = checkIns[0]?.hunger_level;
  if (recentHunger && recentHunger > 4) {
    recommendations.push(`High hunger reported. Add ${Math.round(protein * 0.25)}g protein and fiber-rich veggies to your next meal to stay satiated.`);
  }

  // Limit to top 3 most relevant recommendations
  const prioritizedRecs = recommendations.slice(0, 3);

  return {
    averageMood: Math.round(averages.mood * 10) / 10,
    averageEnergy: Math.round(averages.energy * 10) / 10,
    averageSleep: Math.round(averages.sleep * 10) / 10,
    averageStress: Math.round(averages.stress * 10) / 10,
    trends,
    recommendations: prioritizedRecs,
  };
}

/**
 * Format check-in data for AI coach context
 */
export function formatCheckInsForAI(checkIns: DailyCheckIn[], analysis: CheckInAnalysis): string {
  if (checkIns.length === 0) return "";

  const todaysCheckIn = checkIns[0];
  const today = new Date().toISOString().split('T')[0];
  
  let context = `
DAILY CHECK-IN DATA:`;

  if (todaysCheckIn?.check_in_date === today) {
    context += `
Today's Check-In:
- Mood: ${todaysCheckIn.mood}/5
- Energy Level: ${todaysCheckIn.energy_level}/5
- Sleep Quality: ${todaysCheckIn.sleep_quality}/5${todaysCheckIn.sleep_hours ? ` (${todaysCheckIn.sleep_hours} hours)` : ''}
- Stress Level: ${todaysCheckIn.stress_level}/5
${todaysCheckIn.notes ? `- Notes: "${todaysCheckIn.notes}"` : ''}`;
  }

  if (checkIns.length >= 3) {
    context += `

7-Day Averages:
- Mood: ${analysis.averageMood}/5 (${analysis.trends.mood})
- Energy: ${analysis.averageEnergy}/5 (${analysis.trends.energy})
- Sleep: ${analysis.averageSleep}/5 (${analysis.trends.sleep})
- Stress: ${analysis.averageStress}/5 (${analysis.trends.stress})`;

    if (analysis.recommendations.length > 0) {
      context += `

Pattern-Based Insights:
${analysis.recommendations.map(r => `- ${r}`).join('\n')}`;
    }
  }

  return context;
}
