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

/**
 * Analyze check-in patterns and generate recommendations
 */
export function analyzeCheckIns(checkIns: DailyCheckIn[]): CheckInAnalysis {
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
  }), { mood: 0, energy: 0, sleep: 0, stress: 0 });

  const count = checkIns.length;
  const averages = {
    mood: sum.mood / count,
    energy: sum.energy / count,
    sleep: sum.sleep / count,
    stress: sum.stress / count,
  };

  // Calculate trends (compare first half vs second half)
  const midpoint = Math.floor(count / 2);
  const getTrend = (metric: keyof typeof sum): "improving" | "declining" | "stable" => {
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

  // Generate recommendations based on patterns
  const recommendations: string[] = [];

  if (averages.sleep < 3) {
    recommendations.push("Your sleep quality has been low. Consider magnesium-rich foods in your evening meal and limiting caffeine after 2pm.");
  }

  if (averages.energy < 3) {
    recommendations.push("Energy levels are below optimal. Focus on balanced meals with complex carbs and protein throughout the day.");
  }

  if (averages.stress > 3.5) {
    recommendations.push("Stress has been elevated. Consider shifting some carb calories to healthy fats for more sustained energy.");
  }

  if (averages.mood < 3 && averages.sleep < 3) {
    recommendations.push("Low mood often correlates with poor sleep. Prioritizing sleep hygiene may help both metrics.");
  }

  if (trends.energy === "declining") {
    recommendations.push("Your energy trend is declining. Check your protein and hydration consistency.");
  }

  if (trends.stress === "declining") {
    recommendations.push("Great job — your stress levels are improving! Keep up the habits that are working.");
  }

  return {
    averageMood: Math.round(averages.mood * 10) / 10,
    averageEnergy: Math.round(averages.energy * 10) / 10,
    averageSleep: Math.round(averages.sleep * 10) / 10,
    averageStress: Math.round(averages.stress * 10) / 10,
    trends,
    recommendations,
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
