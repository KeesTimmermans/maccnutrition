import { supabase } from "@/integrations/supabase/client";

export interface PlanMeal {
  name: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// Helper to get the start of the current week (Monday)
export const getWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOr0 = (v: unknown) => (isNum(v) ? v : 0);

/** Flattens plan_data.days[].meals[] into one list, de-duplicated by lowercased trimmed name (first wins). */
export const flattenPlanMeals = (planData: unknown): PlanMeal[] => {
  const days = (planData as { days?: unknown })?.days;
  if (!Array.isArray(days)) return [];

  const seen = new Set<string>();
  const out: PlanMeal[] = [];

  for (const day of days) {
    const meals = (day as { meals?: unknown })?.meals;
    if (!Array.isArray(meals)) continue;
    for (const raw of meals) {
      const m = raw as Record<string, unknown> | null;
      if (!m || typeof m.name !== "string" || !m.name.trim()) continue;
      if (!isNum(m.calories) || !isNum(m.protein)) continue;
      const key = m.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name: m.name,
        type: typeof m.type === "string" ? m.type : "",
        calories: m.calories,
        protein: m.protein,
        carbs: numOr0(m.carbs),
        fats: numOr0(m.fats),
      });
    }
  }

  return out;
};

export const getThisWeeksPlanMeals = async (): Promise<PlanMeal[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("meal_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", getWeekStart())
      .maybeSingle();

    if (error || !data?.plan_data) return [];
    return flattenPlanMeals(data.plan_data);
  } catch {
    return [];
  }
};
