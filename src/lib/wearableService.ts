import { supabase } from "@/integrations/supabase/client";

export type WearableProvider = 'garmin' | 'whoop' | 'apple_health' | 'fitbit';

export interface WearableConnection {
  id: string;
  user_id: string;
  provider: WearableProvider;
  is_connected: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export interface WearableData {
  id: string;
  user_id: string;
  provider: string;
  data_date: string;
  // Sleep
  sleep_duration_minutes: number | null;
  sleep_quality_score: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  awake_minutes: number | null;
  // HRV
  hrv_average: number | null;
  hrv_rmssd: number | null;
  resting_heart_rate: number | null;
  // Activity
  steps: number | null;
  active_calories: number | null;
  total_calories: number | null;
  active_minutes: number | null;
  // Recovery
  recovery_score: number | null;
  strain_score: number | null;
  stress_score: number | null;
  body_battery: number | null;
}

export interface WearableSummary {
  sleepHours: number | null;
  sleepQuality: number | null; // 1-5 scale
  hrv: number | null;
  restingHR: number | null;
  recoveryScore: number | null; // 1-5 scale
  steps: number | null;
  activeMinutes: number | null;
  strain: number | null;
  provider: string | null;
}

export const WEARABLE_PROVIDERS: Record<WearableProvider, {
  name: string;
  icon: string;
  color: string;
  description: string;
  oauthSupported: boolean;
}> = {
  garmin: {
    name: 'Garmin',
    icon: '⌚',
    color: 'bg-blue-500',
    description: 'Sync sleep, HRV, body battery, and activity',
    oauthSupported: true,
  },
  whoop: {
    name: 'WHOOP',
    icon: '🔴',
    color: 'bg-red-500',
    description: 'Sync recovery, strain, sleep, and HRV',
    oauthSupported: true,
  },
  apple_health: {
    name: 'Apple Health',
    icon: '🍎',
    color: 'bg-pink-500',
    description: 'Requires native iOS app',
    oauthSupported: false,
  },
  fitbit: {
    name: 'Fitbit',
    icon: '💚',
    color: 'bg-teal-500',
    description: 'Sync sleep, heart rate, and activity',
    oauthSupported: true,
  },
};

/**
 * Get all wearable connections for the current user
 */
export async function getWearableConnections(): Promise<WearableConnection[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('wearable_connections')
    .select('id, user_id, provider, is_connected, last_sync_at, created_at')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching wearable connections:', error);
    return [];
  }

  return (data || []) as WearableConnection[];
}

/**
 * Get today's wearable data summary
 */
export async function getTodaysWearableData(): Promise<WearableSummary | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('wearable_data')
    .select('*')
    .eq('user_id', user.id)
    .eq('data_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const wearableData = data as WearableData;

  // Convert to summary with normalized scales
  return {
    sleepHours: wearableData.sleep_duration_minutes 
      ? Math.round(wearableData.sleep_duration_minutes / 60 * 10) / 10 
      : null,
    sleepQuality: wearableData.sleep_quality_score 
      ? Math.round(wearableData.sleep_quality_score / 20) // Convert 0-100 to 1-5
      : null,
    hrv: wearableData.hrv_average,
    restingHR: wearableData.resting_heart_rate,
    recoveryScore: wearableData.recovery_score 
      ? Math.round(wearableData.recovery_score / 20) // Convert 0-100 to 1-5
      : null,
    steps: wearableData.steps,
    activeMinutes: wearableData.active_minutes,
    strain: wearableData.strain_score,
    provider: wearableData.provider,
  };
}

/**
 * Get recent wearable data for analysis
 */
export async function getRecentWearableData(days: number = 7): Promise<WearableData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('wearable_data')
    .select('*')
    .eq('user_id', user.id)
    .gte('data_date', startDate.toISOString().split('T')[0])
    .order('data_date', { ascending: false });

  if (error) {
    console.error('Error fetching wearable data:', error);
    return [];
  }

  return (data || []) as WearableData[];
}

/**
 * Create a placeholder connection (for when OAuth isn't set up yet)
 */
export async function createWearableConnection(provider: WearableProvider): Promise<WearableConnection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('wearable_connections')
    .upsert({
      user_id: user.id,
      provider,
      is_connected: false,
    }, {
      onConflict: 'user_id,provider',
    })
    .select('id, user_id, provider, is_connected, last_sync_at, created_at')
    .single();

  if (error) {
    console.error('Error creating wearable connection:', error);
    throw error;
  }

  return data as WearableConnection;
}

/**
 * Disconnect a wearable
 */
export async function disconnectWearable(provider: WearableProvider): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('wearable_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider);

  if (error) {
    console.error('Error disconnecting wearable:', error);
    throw error;
  }
}

/**
 * Format wearable data for AI coach context
 */
export function formatWearableDataForAI(summary: WearableSummary | null, recentData: WearableData[]): string {
  if (!summary && recentData.length === 0) return "";

  let context = `\nWEARABLE DATA (${summary?.provider || 'synced'}):`;

  if (summary) {
    context += `
Today's Metrics:`;
    if (summary.sleepHours) context += `\n- Sleep: ${summary.sleepHours} hours (quality: ${summary.sleepQuality}/5)`;
    if (summary.hrv) context += `\n- HRV: ${summary.hrv}ms`;
    if (summary.restingHR) context += `\n- Resting HR: ${summary.restingHR} bpm`;
    if (summary.recoveryScore) context += `\n- Recovery: ${summary.recoveryScore}/5`;
    if (summary.strain) context += `\n- Strain: ${summary.strain}/21`;
    if (summary.steps) context += `\n- Steps: ${summary.steps.toLocaleString()}`;
    if (summary.activeMinutes) context += `\n- Active Minutes: ${summary.activeMinutes}`;
  }

  if (recentData.length >= 3) {
    // Calculate 7-day averages
    const avgSleep = recentData.reduce((s, d) => s + (d.sleep_duration_minutes || 0), 0) / recentData.length;
    const avgHRV = recentData.filter(d => d.hrv_average).reduce((s, d) => s + (d.hrv_average || 0), 0) / recentData.filter(d => d.hrv_average).length;
    const avgRecovery = recentData.filter(d => d.recovery_score).reduce((s, d) => s + (d.recovery_score || 0), 0) / recentData.filter(d => d.recovery_score).length;

    context += `

7-Day Averages:`;
    if (avgSleep > 0) context += `\n- Avg Sleep: ${(avgSleep / 60).toFixed(1)} hours`;
    if (avgHRV > 0) context += `\n- Avg HRV: ${avgHRV.toFixed(0)}ms`;
    if (avgRecovery > 0) context += `\n- Avg Recovery: ${(avgRecovery / 20).toFixed(1)}/5`;
  }

  return context;
}

/**
 * Auto-fill check-in from wearable data
 */
export function suggestCheckInFromWearable(summary: WearableSummary): {
  sleep: number;
  energy: number;
  stress: number;
} {
  let sleep = 3;
  let energy = 3;
  let stress = 3;

  // Sleep quality from wearable
  if (summary.sleepQuality) {
    sleep = summary.sleepQuality;
  } else if (summary.sleepHours) {
    // Estimate from hours
    if (summary.sleepHours >= 7.5) sleep = 5;
    else if (summary.sleepHours >= 7) sleep = 4;
    else if (summary.sleepHours >= 6) sleep = 3;
    else if (summary.sleepHours >= 5) sleep = 2;
    else sleep = 1;
  }

  // Energy from recovery score
  if (summary.recoveryScore) {
    energy = summary.recoveryScore;
  }

  // Stress from HRV (higher HRV = lower stress)
  if (summary.hrv) {
    if (summary.hrv >= 60) stress = 1;
    else if (summary.hrv >= 50) stress = 2;
    else if (summary.hrv >= 40) stress = 3;
    else if (summary.hrv >= 30) stress = 4;
    else stress = 5;
  }

  return { sleep, energy, stress };
}
