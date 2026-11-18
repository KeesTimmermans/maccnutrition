import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getEdgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import type { ChecklistCompleted, ChecklistItem, DailyChecklistRow } from "@/lib/dailyChecklist";

/** Returns today's list, generating it once on the server if it doesn't exist yet. */
export const getOrGenerateDailyChecklist = async (params: {
  date: string;
  language?: string;
  proteinTarget?: number;
}): Promise<DailyChecklistRow> => {
  const { data, error } = await supabase.functions.invoke("generate-daily-checklist", { body: params });
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error));
  if (!data?.checklist) throw new Error("No checklist was returned. Please try again.");
  const row = data.checklist;
  return {
    ...row,
    items: Array.isArray(row.items) ? row.items : [],
    completed: row.completed && typeof row.completed === "object" ? row.completed : {},
  } as DailyChecklistRow;
};

export const saveChecklistCompleted = async (id: string, completed: ChecklistCompleted) => {
  const { error } = await supabase
    .from("daily_checklists")
    .update({ completed: completed as unknown as Json })
    .eq("id", id);
  if (error) throw error;
};

export const saveChecklistItems = async (id: string, items: ChecklistItem[]) => {
  const { error } = await supabase
    .from("daily_checklists")
    .update({ items: items as unknown as Json })
    .eq("id", id);
  if (error) throw error;
};
