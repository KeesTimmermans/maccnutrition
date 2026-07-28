import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok, dayBounds } from "../supabase";

export default defineTool({
  name: "list_meals",
  title: "List meals for a day",
  description: "List the signed-in user's logged meals for a given day (defaults to today).",
  inputSchema: {
    date: z.string().optional().describe("Day in YYYY-MM-DD format. Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const [start, end, day] = dayBounds(date);
    const { data, error } = await supabaseForUser(ctx)
      .from("meals")
      .select("id, name, calories, protein, carbs, fats, sugar, notes, logged_at")
      .gte("logged_at", start)
      .lte("logged_at", end)
      .order("logged_at", { ascending: true });

    if (error) return fail(error.message);
    const meals = data ?? [];
    if (meals.length === 0) return ok(`No meals logged on ${day}.`, { date: day, meals: [] });

    const lines = meals.map(
      (m) => `- ${m.name}: ${m.calories} kcal, P ${m.protein}g / C ${m.carbs}g / F ${m.fats}g`,
    );
    return ok(`Meals on ${day}:\n${lines.join("\n")}`, { date: day, meals });
  },
});
