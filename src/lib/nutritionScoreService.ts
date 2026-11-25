import { supabase } from "@/integrations/supabase/client";
import type { Answers, AreaId, AreaScores, ScoreResult } from "@/lib/nutritionScore";

export interface StoredScore {
  id: string;
  takenAt: Date;
  total: number;
  areas: AreaScores;
  focusArea: AreaId;
}

const toStored = (r: any): StoredScore => ({
  id: r.id,
  takenAt: new Date(r.taken_at),
  total: r.total_score,
  areas: r.area_scores as AreaScores,
  focusArea: r.focus_area as AreaId,
});

export async function saveScore(answers: Answers, result: ScoreResult): Promise<StoredScore> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("nutrition_scores")
    .insert({
      user_id: user.id,
      answers,
      total_score: result.total,
      area_scores: result.areas,
      focus_area: result.focusArea,
    })
    .select("id, taken_at, total_score, area_scores, focus_area")
    .single();
  if (error) throw error;
  return toStored(data);
}

/** All of the user's results, newest first. */
export async function listScores(): Promise<StoredScore[]> {
  const { data, error } = await supabase
    .from("nutrition_scores")
    .select("id, taken_at, total_score, area_scores, focus_area")
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toStored);
}
