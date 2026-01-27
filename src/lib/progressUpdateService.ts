import { supabase } from "@/integrations/supabase/client";
import { UserBaseline } from "@/lib/userService";

export interface CoachingFocusPoint {
  emoji: string;
  text: string;
  tip?: string; // Optional actionable tip on how to achieve this focus point
}

export interface ProgressUpdate {
  id: string;
  user_id: string;
  created_at: string;
  satisfaction_choice: string;
  user_feedback: string | null;
  coach_response: string | null;
  coaching_focus_points: CoachingFocusPoint[] | null;
  adjustments: {
    calorieChange?: number;
    proteinChange?: number;
    reason?: string;
  } | null;
  target_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fats_grams: number | null;
  weight: number | null;
  body_fat_percentage: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  neck_cm: number | null;
}

export interface SaveProgressUpdateParams {
  satisfactionChoice: "happy" | "more_progress" | "update_measurements";
  userFeedback?: string;
  coachResponse?: string;
  coachingFocusPoints?: CoachingFocusPoint[];
  adjustments?: {
    calorieChange: number;
    proteinChange: number;
    reason: string;
  };
  baseline: UserBaseline;
  measurements?: {
    weight?: number | null;
    bodyFatPercentage?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    chestCm?: number | null;
    armCm?: number | null;
    thighCm?: number | null;
    neckCm?: number | null;
  };
}

/**
 * Parse focus points from AI coach response
 * Looks for content between ---FOCUS_POINTS--- and ---END_FOCUS---
 */
export const parseFocusPoints = (response: string): { cleanResponse: string; focusPoints: CoachingFocusPoint[] } => {
  const focusPointsMatch = response.match(/---FOCUS_POINTS---([\s\S]*?)---END_FOCUS---/);
  
  if (!focusPointsMatch) {
    return { cleanResponse: response, focusPoints: [] };
  }
  
  // Extract and clean the focus points section
  const focusPointsRaw = focusPointsMatch[1].trim();
  const focusPoints: CoachingFocusPoint[] = [];
  
  // Parse each line that starts with an emoji
  const lines = focusPointsRaw.split('\n').filter(line => line.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    // Match emoji at start of line
    const emojiMatch = trimmed.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✨|💪|🎯|🥗|💧|🔥|⚡|🏃|😴|🧘|📊|🎉|🥩)/u);
    if (emojiMatch) {
      focusPoints.push({
        emoji: emojiMatch[1],
        text: trimmed.slice(emojiMatch[1].length).trim()
      });
    }
  }
  
  // Remove the focus points section from the response
  const cleanResponse = response.replace(/---FOCUS_POINTS---[\s\S]*?---END_FOCUS---/, '').trim();
  
  return { cleanResponse, focusPoints };
};

/**
 * Parse daily focus points from AI coach check-in response
 * Looks for content between ---DAILY_FOCUS--- and ---END_DAILY_FOCUS---
 * Also handles fallback formats like **Today's Focus:** with bullet points
 */
export const parseDailyFocusPoints = (response: string): { cleanResponse: string; focusPoints: CoachingFocusPoint[] } => {
  const focusPoints: CoachingFocusPoint[] = [];
  let cleanResponse = response;
  
  // Emoji pattern for matching focus point lines
  const emojiPattern = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✨|💪|🎯|🥗|💧|🔥|⚡|🏃|😴|🧘|📊|🎉|🥩|🍳|🧘‍♀️|🧘‍♂️|💆|💆‍♀️|💆‍♂️|🏋️|🏋️‍♀️|🏋️‍♂️|🚶|🚶‍♀️|🚶‍♂️|🏃‍♀️|🏃‍♂️|🍎|🥦|🍗|🐟|🥚|🧀|🥜|🫘|🍚|🥔|🍠|🥤|☕|🫖|🍵|🌙|⏰|📝|📈|📉|🎯|⭐|🌟|💫|✅|❌|⚠️|💡|🔔|🧠|❤️|💚|💙|💛|🧡|💜|🖤|🤍|🤎)/u;
  
  // Primary pattern: ---DAILY_FOCUS--- markers
  const primaryMatch = response.match(/---DAILY_FOCUS---([\s\S]*?)---END_DAILY_FOCUS---/);
  
  if (primaryMatch) {
    const focusPointsRaw = primaryMatch[1].trim();
    const lines = focusPointsRaw.split('\n').filter(line => line.trim());
    
    let currentPoint: CoachingFocusPoint | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if this is a tip line (starts with →)
      if (trimmed.startsWith('→') && currentPoint) {
        currentPoint.tip = trimmed.slice(1).trim();
        continue;
      }
      
      // Match emoji at start of line (new focus point)
      const emojiMatch = trimmed.match(emojiPattern);
      if (emojiMatch) {
        // Save previous point if exists
        if (currentPoint) {
          focusPoints.push(currentPoint);
        }
        currentPoint = {
          emoji: emojiMatch[1],
          text: trimmed.slice(emojiMatch[1].length).trim()
        };
      }
    }
    
    // Don't forget to push the last point
    if (currentPoint) {
      focusPoints.push(currentPoint);
    }
    
    cleanResponse = response.replace(/---DAILY_FOCUS---[\s\S]*?---END_DAILY_FOCUS---/, '').trim();
    return { cleanResponse, focusPoints };
  }
  
  // Fallback pattern: **Today's Focus:** or similar headers with bullet points (* emoji text)
  const fallbackMatch = response.match(/\*\*Today'?s?\s*Focus:?\*\*\s*([\s\S]*?)(?=\n\n[A-Z]|\n\n\*\*|$)/i);
  
  if (fallbackMatch) {
    const focusSection = fallbackMatch[1].trim();
    // Match lines that start with * emoji or just emoji
    const bulletPattern = /^\*?\s*([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✨|💪|🎯|🥗|💧|🔥|⚡|🏃|😴|🧘|📊|🎉|🥩|🍳|💆|🏋️|🚶|🍎|🥦|🍗|🐟|🥚|🧀|🥜|🫘|🍚|🥔|🍠|🥤|☕|🌙|⏰|📝|📈|🎯|⭐|✅|💡|🧠|❤️|💚|💙|💛|🧡|💜)\s*(.+)$/gmu;
    
    let match;
    while ((match = bulletPattern.exec(focusSection)) !== null) {
      focusPoints.push({
        emoji: match[1],
        text: match[2].trim()
      });
    }
    
    // Remove the focus section from response if we found points
    if (focusPoints.length > 0) {
      cleanResponse = response.replace(/\*\*Today'?s?\s*Focus:?\*\*\s*[\s\S]*?(?=\n\n[A-Z]|\n\n\*\*|$)/i, '').trim();
    }
    
    return { cleanResponse, focusPoints };
  }
  
  return { cleanResponse: response, focusPoints: [] };
};

/**
 * Save a progress update to the database
 */
export const saveProgressUpdate = async (params: SaveProgressUpdateParams): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { satisfactionChoice, userFeedback, coachResponse, coachingFocusPoints, adjustments, baseline, measurements } = params;

  const insertData = {
    user_id: user.id,
    satisfaction_choice: satisfactionChoice,
    user_feedback: userFeedback || null,
    coach_response: coachResponse || null,
    coaching_focus_points: coachingFocusPoints ? JSON.parse(JSON.stringify(coachingFocusPoints)) : null,
    adjustments: adjustments ? {
      calorieChange: adjustments.calorieChange,
      proteinChange: adjustments.proteinChange,
      reason: adjustments.reason,
    } : null,
    // Snapshot of current targets
    target_calories: baseline.target_calories,
    protein_grams: baseline.protein_grams,
    carbs_grams: baseline.carbs_grams,
    fats_grams: baseline.fats_grams,
    // Snapshot of measurements
    weight: measurements?.weight ?? baseline.weight,
    body_fat_percentage: measurements?.bodyFatPercentage ?? baseline.body_fat_percentage,
    waist_cm: measurements?.waistCm ?? baseline.waist_cm,
    hip_cm: measurements?.hipCm ?? baseline.hip_cm,
    chest_cm: measurements?.chestCm ?? baseline.chest_cm,
    arm_cm: measurements?.armCm ?? baseline.arm_cm,
    thigh_cm: measurements?.thighCm ?? baseline.thigh_cm,
    neck_cm: measurements?.neckCm ?? baseline.neck_cm,
  };

  const { error } = await supabase.from("progress_updates").insert(insertData);

  if (error) {
    console.error("Error saving progress update:", error);
    throw error;
  }
};

/**
 * Get all progress updates for the current user
 */
export const getProgressUpdates = async (): Promise<ProgressUpdate[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("progress_updates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching progress updates:", error);
    throw error;
  }

  return (data || []).map((item) => ({
    ...item,
    adjustments: item.adjustments as unknown as ProgressUpdate["adjustments"],
    coaching_focus_points: item.coaching_focus_points as unknown as ProgressUpdate["coaching_focus_points"],
  }));
};

/**
 * Get the most recent progress update
 */
export const getLatestProgressUpdate = async (): Promise<ProgressUpdate | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("progress_updates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest progress update:", error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    adjustments: data.adjustments as unknown as ProgressUpdate["adjustments"],
    coaching_focus_points: data.coaching_focus_points as unknown as ProgressUpdate["coaching_focus_points"],
  };
};

/**
 * Get the active coaching focus points (from most recent progress update within last 30 days)
 */
export const getActiveCoachingFocusPoints = async (): Promise<CoachingFocusPoint[] | null> => {
  const latest = await getLatestProgressUpdate();
  if (!latest || !latest.coaching_focus_points) return null;
  
  // Check if the progress update is within the last 30 days
  const updateDate = new Date(latest.created_at);
  const daysSinceUpdate = Math.floor((Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceUpdate > 30) return null;
  
  return latest.coaching_focus_points;
};
