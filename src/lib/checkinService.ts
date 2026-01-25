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
 * Build temporal check-in analysis (today vs yesterday vs recent trend)
 */
export interface ConsecutivePattern {
  metric: string;
  value: number;
  days: number;
  interpretation: string;
}

export interface TemporalCheckInContext {
  today: DailyCheckIn | null;
  yesterday: DailyCheckIn | null;
  dayBeforeYesterday: DailyCheckIn | null;
  recentDays: DailyCheckIn[];
  changes: {
    moodChange: "better" | "worse" | "same" | "unknown";
    energyChange: "better" | "worse" | "same" | "unknown";
    sleepChange: "better" | "worse" | "same" | "unknown";
    stressChange: "better" | "worse" | "same" | "unknown"; // Note: lower is better for stress
  };
  patterns: {
    consistentlyLowEnergy: boolean;
    consistentlyHighStress: boolean;
    sleepDebtAccumulating: boolean;
    moodImproving: boolean;
    recoveryNeeded: boolean;
  };
  consecutivePatterns: ConsecutivePattern[];
}

/**
 * Detect when a metric has the same or very similar value for 3+ consecutive days
 */
function detectConsecutivePatterns(checkIns: DailyCheckIn[]): ConsecutivePattern[] {
  if (checkIns.length < 3) return [];

  // Sort by date descending (most recent first)
  const sorted = [...checkIns].sort((a, b) => 
    new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );

  const patterns: ConsecutivePattern[] = [];
  
  const metrics: {
    key: keyof DailyCheckIn;
    label: string;
    getInterpretation: (value: number, days: number) => string;
  }[] = [
    {
      key: 'mood',
      label: 'Mood',
      getInterpretation: (value, days) => {
        if (value <= 2) return `Mood has been low (${value}/5) for ${days} consecutive days — this is a pattern worth addressing`;
        if (value >= 4) return `Mood has been consistently good (${value}/5) for ${days} days — great stability!`;
        return `Mood has been steady at ${value}/5 for ${days} days`;
      }
    },
    {
      key: 'energy_level',
      label: 'Energy',
      getInterpretation: (value, days) => {
        if (value <= 2) return `Energy has been persistently low (${value}/5) for ${days} days straight — this needs attention`;
        if (value >= 4) return `Energy has been high (${value}/5) for ${days} consecutive days — momentum is building!`;
        return `Energy has been stable at ${value}/5 for ${days} days`;
      }
    },
    {
      key: 'sleep_quality',
      label: 'Sleep Quality',
      getInterpretation: (value, days) => {
        if (value <= 2) return `Sleep quality has been poor (${value}/5) for ${days} days in a row — this is impacting recovery`;
        if (value >= 4) return `Sleep has been excellent (${value}/5) for ${days} consecutive nights`;
        return `Sleep quality has been consistent at ${value}/5 for ${days} days`;
      }
    },
    {
      key: 'stress_level',
      label: 'Stress',
      getInterpretation: (value, days) => {
        if (value >= 4) return `Stress has been elevated (${value}/5) for ${days} consecutive days — chronic stress needs intervention`;
        if (value <= 2) return `Stress has been well-managed (${value}/5) for ${days} days — keep up the good work`;
        return `Stress has been moderate (${value}/5) for ${days} days`;
      }
    },
    {
      key: 'hunger_level',
      label: 'Hunger',
      getInterpretation: (value, days) => {
        if (value >= 4) return `Hunger has been high (${value}/5) for ${days} consecutive days — may need to adjust meal timing or portions`;
        if (value <= 2) return `Appetite has been low (${value}/5) for ${days} days — worth monitoring`;
        return `Hunger has been stable at ${value}/5 for ${days} days`;
      }
    },
    {
      key: 'hydration_feeling',
      label: 'Hydration',
      getInterpretation: (value, days) => {
        if (value <= 2) return `Hydration feeling has been low (${value}/5) for ${days} days — consistent dehydration is concerning`;
        if (value >= 4) return `Hydration has been solid (${value}/5) for ${days} consecutive days`;
        return `Hydration feeling has been at ${value}/5 for ${days} days`;
      }
    }
  ];

  for (const metric of metrics) {
    // Find consecutive days with same value (allowing ±0.5 tolerance for similarity)
    let consecutiveCount = 1;
    let lastValue = sorted[0]?.[metric.key] as number | null | undefined;
    
    if (lastValue == null) continue;

    for (let i = 1; i < sorted.length; i++) {
      const currentValue = sorted[i]?.[metric.key] as number | null | undefined;
      
      // Check if dates are consecutive
      const prevDate = new Date(sorted[i - 1].check_in_date);
      const currDate = new Date(sorted[i].check_in_date);
      const dayDiff = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff !== 1) break; // Not consecutive days
      
      if (currentValue != null && currentValue === lastValue) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    // Only report if 3+ consecutive days with same value
    if (consecutiveCount >= 3) {
      patterns.push({
        metric: metric.label,
        value: lastValue,
        days: consecutiveCount,
        interpretation: metric.getInterpretation(lastValue, consecutiveCount)
      });
    }
  }

  return patterns;
}

export function buildTemporalCheckInContext(checkIns: DailyCheckIn[]): TemporalCheckInContext {
  const sortedByDate = [...checkIns].sort((a, b) => 
    new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );

  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  const dayBeforeDate = new Date();
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
  const dayBefore = dayBeforeDate.toISOString().split('T')[0];

  const todaysCheckIn = sortedByDate.find(c => c.check_in_date === today) || null;
  const yesterdaysCheckIn = sortedByDate.find(c => c.check_in_date === yesterday) || null;
  const dayBeforeCheckIn = sortedByDate.find(c => c.check_in_date === dayBefore) || null;

  // Calculate changes (today vs yesterday, or yesterday vs day before if no today)
  const compareWith = todaysCheckIn ? yesterdaysCheckIn : dayBeforeCheckIn;
  const current = todaysCheckIn || yesterdaysCheckIn;

  const getChange = (
    currentVal: number | null | undefined, 
    previousVal: number | null | undefined,
    invert = false
  ): "better" | "worse" | "same" | "unknown" => {
    if (currentVal == null || previousVal == null) return "unknown";
    const diff = currentVal - previousVal;
    if (Math.abs(diff) < 1) return "same";
    if (invert) return diff < 0 ? "better" : "worse"; // For stress
    return diff > 0 ? "better" : "worse";
  };

  const changes = {
    moodChange: getChange(current?.mood, compareWith?.mood),
    energyChange: getChange(current?.energy_level, compareWith?.energy_level),
    sleepChange: getChange(current?.sleep_quality, compareWith?.sleep_quality),
    stressChange: getChange(current?.stress_level, compareWith?.stress_level, true), // Invert: lower stress is better
  };

  // Build patterns from last 3-5 days
  const recentDays = sortedByDate.slice(0, 5);
  
  const avgEnergy = recentDays.length > 0
    ? recentDays.reduce((sum, c) => sum + (c.energy_level || 3), 0) / recentDays.length
    : 3;
  const avgStress = recentDays.length > 0
    ? recentDays.reduce((sum, c) => sum + (c.stress_level || 3), 0) / recentDays.length
    : 3;
  const avgSleep = recentDays.length > 0
    ? recentDays.reduce((sum, c) => sum + (c.sleep_quality || 3), 0) / recentDays.length
    : 3;
  const avgMood = recentDays.length > 0
    ? recentDays.reduce((sum, c) => sum + (c.mood || 3), 0) / recentDays.length
    : 3;

  // Check if mood is trending up over last 3 check-ins
  const moodTrend = recentDays.slice(0, 3);
  const moodImproving = moodTrend.length >= 2 && 
    (moodTrend[0]?.mood || 3) > (moodTrend[moodTrend.length - 1]?.mood || 3);

  const patterns = {
    consistentlyLowEnergy: avgEnergy < 2.5,
    consistentlyHighStress: avgStress > 3.5,
    sleepDebtAccumulating: avgSleep < 2.5,
    moodImproving,
    recoveryNeeded: avgEnergy < 2.5 && avgSleep < 3,
  };

  // Detect consecutive same-value patterns (3+ days)
  const consecutivePatterns = detectConsecutivePatterns(checkIns);

  return {
    today: todaysCheckIn,
    yesterday: yesterdaysCheckIn,
    dayBeforeYesterday: dayBeforeCheckIn,
    recentDays,
    changes,
    patterns,
    consecutivePatterns,
  };
}

/**
 * Format check-in data for AI coach context with temporal awareness
 */
export function formatCheckInsForAI(checkIns: DailyCheckIn[], analysis: CheckInAnalysis): string {
  if (checkIns.length === 0) return "";

  const temporal = buildTemporalCheckInContext(checkIns);
  const { today, yesterday, changes, patterns, consecutivePatterns } = temporal;

  let context = `
DAILY CHECK-IN DATA (Temporal View):

⚠️ RATING SCALE INTERPRETATION:
- Mood: 1 = terrible, 5 = excellent (higher is better)
- Energy: 1 = exhausted, 5 = energized (higher is better)
- Sleep Quality: 1 = poor, 5 = excellent (higher is better)
- Stress: 1 = calm/relaxed, 5 = very stressed (LOWER is better for stress)`;

  // Today's check-in
  if (today) {
    context += `

📍 TODAY'S CHECK-IN:
- Mood: ${today.mood}/5 ${today.mood >= 4 ? '(good)' : today.mood <= 2 ? '(struggling)' : '(okay)'}
- Energy Level: ${today.energy_level}/5 ${today.energy_level >= 4 ? '(energized)' : today.energy_level <= 2 ? '(low)' : '(moderate)'}
- Sleep Quality: ${today.sleep_quality}/5 ${today.sleep_quality >= 4 ? '(rested well)' : today.sleep_quality <= 2 ? '(poor sleep)' : '(okay)'}${today.sleep_hours ? ` (${today.sleep_hours} hours)` : ''}
- Stress Level: ${today.stress_level}/5 ${today.stress_level <= 2 ? '(calm)' : today.stress_level >= 4 ? '(stressed)' : '(moderate)'}
${today.notes ? `- Notes: "${today.notes}"` : ''}`;
  }

  // Yesterday's check-in for comparison
  if (yesterday) {
    context += `

📍 YESTERDAY'S CHECK-IN (for comparison):
- Mood: ${yesterday.mood}/5 ${yesterday.mood >= 4 ? '(good)' : yesterday.mood <= 2 ? '(struggling)' : '(okay)'}
- Energy Level: ${yesterday.energy_level}/5 ${yesterday.energy_level >= 4 ? '(energized)' : yesterday.energy_level <= 2 ? '(low)' : '(moderate)'}
- Sleep Quality: ${yesterday.sleep_quality}/5 ${yesterday.sleep_quality >= 4 ? '(rested well)' : yesterday.sleep_quality <= 2 ? '(poor sleep)' : '(okay)'}${yesterday.sleep_hours ? ` (${yesterday.sleep_hours} hours)` : ''}
- Stress Level: ${yesterday.stress_level}/5 ${yesterday.stress_level <= 2 ? '(calm)' : yesterday.stress_level >= 4 ? '(stressed)' : '(moderate)'}`;
  }

  // Day-over-day changes
  if (today && yesterday) {
    context += `

📊 DAY-OVER-DAY CHANGES (Today vs Yesterday):
- Mood: ${changes.moodChange === 'better' ? '⬆️ improved' : changes.moodChange === 'worse' ? '⬇️ declined' : changes.moodChange === 'same' ? '➡️ stable' : 'N/A'}
- Energy: ${changes.energyChange === 'better' ? '⬆️ improved' : changes.energyChange === 'worse' ? '⬇️ declined' : changes.energyChange === 'same' ? '➡️ stable' : 'N/A'}
- Sleep: ${changes.sleepChange === 'better' ? '⬆️ improved' : changes.sleepChange === 'worse' ? '⬇️ declined' : changes.sleepChange === 'same' ? '➡️ stable' : 'N/A'}
- Stress: ${changes.stressChange === 'better' ? '⬇️ reduced (good)' : changes.stressChange === 'worse' ? '⬆️ increased' : changes.stressChange === 'same' ? '➡️ stable' : 'N/A'}`;
  }

  // CONSECUTIVE PATTERNS - This is the key addition!
  if (consecutivePatterns.length > 0) {
    context += `

🔴 CONSECUTIVE PATTERN ALERT (SAME VALUES FOR 3+ DAYS):
${consecutivePatterns.map(p => `- ${p.metric}: ${p.interpretation}`).join('\n')}

⚠️ IMPORTANT: When a user logs the same value for 3+ consecutive days, this is a SIGNIFICANT pattern that should be directly addressed in your response. 
- If it's a NEGATIVE pattern (low energy, high stress, poor sleep), acknowledge the persistence and offer specific interventions
- If it's a POSITIVE pattern (good mood, low stress), celebrate the consistency and reinforce what's working
- Use phrases like "I notice you've been at [X] for [N] days straight" to show you're paying attention`;
  }

  // Multi-day patterns
  const activePatterns: string[] = [];
  if (patterns.consistentlyLowEnergy) activePatterns.push("Energy has been consistently low over recent days");
  if (patterns.consistentlyHighStress) activePatterns.push("Stress levels have been elevated for several days");
  if (patterns.sleepDebtAccumulating) activePatterns.push("Sleep debt appears to be accumulating");
  if (patterns.moodImproving) activePatterns.push("Mood has been trending upward");
  if (patterns.recoveryNeeded) activePatterns.push("Body may need recovery focus (low energy + poor sleep)");

  if (activePatterns.length > 0) {
    context += `

🔍 MULTI-DAY PATTERNS DETECTED:
${activePatterns.map(p => `- ${p}`).join('\n')}`;
  }

  // 7-day trends
  if (checkIns.length >= 3) {
    context += `

📈 7-DAY AVERAGES & TRENDS:
- Mood: ${analysis.averageMood}/5 (${analysis.trends.mood})
- Energy: ${analysis.averageEnergy}/5 (${analysis.trends.energy})
- Sleep: ${analysis.averageSleep}/5 (${analysis.trends.sleep})
- Stress: ${analysis.averageStress}/5 (${analysis.trends.stress})`;
  }

  return context;
}
