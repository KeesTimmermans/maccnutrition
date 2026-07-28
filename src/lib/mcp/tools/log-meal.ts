import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok, dayBounds } from "../supabase";

export default defineTool({
  name: "log_meal",
  title: "Log a meal",
  description: "Log a meal with its macros for the signed-in MacNutrition user.",
  inputSchema: {
    name: z.string().trim().min(1).describe("Meal name, e.g. 'Chicken and rice'."),
    calories: z.number().min(0).max(10000).describe("Calories (kcal)."),
    protein: z.number().min(0).max(1000).describe("Protein in grams."),
    carbs: z.number().min(0).max(1000).describe("Carbohydrates in grams."),
    fats: z.number().min(0).max(1000).describe("Fat in grams."),
    sugar: z.number().min(0).max(1000).optional().describe("Sugar in grams."),
    notes: z.string().max(500).optional().describe("Optional notes about the meal."),
    logged_at: z.string().optional().describe("ISO timestamp for when the meal was eaten. Defaults to now."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("meals")
      .insert({
        user_id: ctx.getUserId(),
        name: input.name,
        calories: input.calories,
        protein: input.protein,
        carbs: input.carbs,
        fats: input.fats,
        sugar: input.sugar ?? 0,
        notes: input.notes ?? null,
        ...(input.logged_at ? { logged_at: input.logged_at } : {}),
      })
      .select()
      .single();

    if (error) return fail(error.message);
    const [, , day] = dayBounds(String(data.logged_at).slice(0, 10));
    return ok(
      `Logged "${data.name}" (${data.calories} kcal, ${data.protein}g protein, ${data.carbs}g carbs, ${data.fats}g fat) on ${day}.`,
      { meal: data },
    );
  },
});
