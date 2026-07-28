import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok, dayBounds } from "../supabase";

export default defineTool({
  name: "get_daily_summary",
  title: "Get daily nutrition summary",
  description:
    "Get the signed-in user's totals for a day (calories, macros, water) compared with their MacNutrition targets.",
  inputSchema: {
    date: z.string().optional().describe("Day in YYYY-MM-DD format. Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const [start, end, day] = dayBounds(date);

    const [mealsRes, waterRes, baselineRes] = await Promise.all([
      supabase.from("meals").select("calories, protein, carbs, fats, sugar").gte("logged_at", start).lte("logged_at", end),
      supabase.from("water_intake").select("amount_ml").gte("logged_at", start).lte("logged_at", end),
      supabase
        .from("user_baselines")
        .select("target_calories, protein_grams, carbs_grams, fats_grams, water_liters")
        .maybeSingle(),
    ]);

    if (mealsRes.error) return fail(mealsRes.error.message);
    if (waterRes.error) return fail(waterRes.error.message);

    const totals = (mealsRes.data ?? []).reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories ?? 0),
        protein: acc.protein + (m.protein ?? 0),
        carbs: acc.carbs + (m.carbs ?? 0),
        fats: acc.fats + (m.fats ?? 0),
        sugar: acc.sugar + (m.sugar ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0 },
    );
    const waterMl = (waterRes.data ?? []).reduce((sum, w) => sum + (w.amount_ml ?? 0), 0);
    const targets = baselineRes.data ?? null;

    const summary = {
      date: day,
      totals,
      water_ml: waterMl,
      targets: targets
        ? {
            calories: targets.target_calories,
            protein: targets.protein_grams,
            carbs: targets.carbs_grams,
            fats: targets.fats_grams,
            water_ml: targets.water_liters ? Math.round(Number(targets.water_liters) * 1000) : null,
          }
        : null,
    };

    const t = summary.targets;
    const text = [
      `Nutrition summary for ${day}:`,
      `Calories: ${Math.round(totals.calories)}${t?.calories ? ` / ${t.calories}` : ""} kcal`,
      `Protein: ${Math.round(totals.protein)}${t?.protein ? ` / ${t.protein}` : ""} g`,
      `Carbs: ${Math.round(totals.carbs)}${t?.carbs ? ` / ${t.carbs}` : ""} g`,
      `Fat: ${Math.round(totals.fats)}${t?.fats ? ` / ${t.fats}` : ""} g`,
      `Water: ${waterMl}${t?.water_ml ? ` / ${t.water_ml}` : ""} ml`,
    ].join("\n");

    return ok(text, summary);
  },
});
