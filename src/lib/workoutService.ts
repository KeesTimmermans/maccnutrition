import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";


export type WorkoutType =
  | "weightlifting"
  | "cardio"
  | "crossfit"
  | "yoga"
  | "hiit"
  | "swimming"
  | "cycling"
  | "sports"
  | "martial_arts"
  | "dance"
  | "walking";

export type WorkoutSource = "manual" | "photo" | "checkbox_only";

export interface WorkoutSet {
  reps: number;
  weight: number;
  unit: "kg" | "lb";
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  workout_date: string;
  workout_type: WorkoutType | string;
  duration_minutes: number | null;
  notes: string | null;
  source: WorkoutSource;
  photo_url: string | null;
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutInput {
  workout_date: string;
  workout_type: WorkoutType | string;
  duration_minutes?: number | null;
  notes?: string | null;
  source?: WorkoutSource;
  photo_url?: string | null;
  exercises?: WorkoutExercise[];
}

function normalizeWorkout(row: Record<string, unknown>): Workout {
  return {
    ...(row as unknown as Workout),
    exercises: Array.isArray(row.exercises) ? (row.exercises as WorkoutExercise[]) : [],
  };
}

/**
 * Create a new workout for the current user
 */
export async function saveWorkout(input: WorkoutInput): Promise<Workout | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      workout_date: input.workout_date,
      workout_type: input.workout_type,
      duration_minutes: input.duration_minutes ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      photo_url: input.photo_url ?? null,
      exercises: (input.exercises ?? []) as unknown as never,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving workout:", error);
    throw error;
  }

  return data ? normalizeWorkout(data) : null;
}

/**
 * Update an existing workout
 */
export async function updateWorkout(
  id: string,
  updates: Partial<WorkoutInput>
): Promise<Workout | null> {
  const payload: Record<string, unknown> = {};
  if (updates.workout_date !== undefined) payload.workout_date = updates.workout_date;
  if (updates.workout_type !== undefined) payload.workout_type = updates.workout_type;
  if (updates.duration_minutes !== undefined) payload.duration_minutes = updates.duration_minutes;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.source !== undefined) payload.source = updates.source;
  if (updates.photo_url !== undefined) payload.photo_url = updates.photo_url;
  if (updates.exercises !== undefined) payload.exercises = updates.exercises;

  const { data, error } = await supabase
    .from("workouts")
    .update(payload as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating workout:", error);
    throw error;
  }

  return data ? normalizeWorkout(data) : null;
}

/**
 * Delete a workout
 */
export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from("workouts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting workout:", error);
    throw error;
  }
}

/**
 * Get all workouts logged on a given date (YYYY-MM-DD)
 */
export async function getWorkoutsForDate(dateStr: string): Promise<Workout[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", user.id)
    .eq("workout_date", dateStr)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching workouts for date:", error);
    return [];
  }

  return (data || []).map(normalizeWorkout);
}

/**
 * Get workouts from the last N days, most recent first
 */
export async function getRecentWorkouts(days: number = 30): Promise<Workout[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const start = new Date();
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", user.id)
    .gte("workout_date", startStr)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching recent workouts:", error);
    return [];
  }

  return (data || []).map(normalizeWorkout);
}

/**
 * Autocomplete: distinct exercise names from the user's last 90 days,
 * matched against the query (prefix matches first, then contains).
 */
export async function getExerciseNameSuggestions(query: string): Promise<string[]> {
  const workouts = await getRecentWorkouts(90);

  const names = new Map<string, string>();
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const name = (exercise?.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!names.has(key)) names.set(key, name);
    }
  }

  const q = query.trim().toLowerCase();
  const all = Array.from(names.entries());
  if (!q) return all.map(([, name]) => name).slice(0, 10);

  const startsWith = all.filter(([key]) => key.startsWith(q)).map(([, name]) => name);
  const contains = all
    .filter(([key]) => !key.startsWith(q) && key.includes(q))
    .map(([, name]) => name);

  return [...startsWith, ...contains].slice(0, 10);
}
