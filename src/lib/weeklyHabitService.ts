import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface WeeklyHabit {
  id: string;
  user_id: string;
  week_start_date: string;
  habit_title: string;
  habit_description: string;
  difficulty_label: string | null;
  completed_dates: string[];
  previous_habit_id: string | null;
  created_at: string;
  updated_at: string;
}

async function getEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) {
        return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
      }
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export const getOrGenerateWeeklyHabit = async (
  userContext: Record<string, unknown>
): Promise<WeeklyHabit> => {
  const { data, error } = await supabase.functions.invoke("generate-weekly-habit", {
    body: { userContext },
  });

  if (error) {
    console.error("Error generating weekly habit:", error);
    throw new Error(await getEdgeFunctionErrorMessage(error));
  }

  if (!data?.habit) {
    throw new Error("No habit was returned. Please try again.");
  }

  return data.habit as WeeklyHabit;
};

export const toggleHabitDay = async (
  habitId: string,
  dateStr: string,
  currentDates: string[]
): Promise<WeeklyHabit> => {
  const has = currentDates.includes(dateStr);
  const newArray = has
    ? currentDates.filter((d) => d !== dateStr)
    : [...currentDates, dateStr].sort();

  const { data, error } = await supabase
    .from("weekly_habits")
    .update({ completed_dates: newArray })
    .eq("id", habitId)
    .select()
    .single();

  if (error) {
    console.error("Error updating weekly habit:", error);
    throw error;
  }

  return data as WeeklyHabit;
};
