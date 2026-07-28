import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "get_nutrition_targets",
  title: "Get nutrition targets and profile",
  description:
    "Get the signed-in user's MacNutrition baseline: daily calorie and macro targets, hydration target, goal, diet type and allergies.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("user_baselines")
      .select(
        "primary_goal, activity_level, diet_type, allergies, conditions, target_calories, protein_grams, carbs_grams, fats_grams, sugar_grams, water_liters, unit_system",
      )
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return ok("No baseline found yet. Complete onboarding in the MacNutrition app first.", { targets: null });

    const text = [
      `Goal: ${data.primary_goal ?? "not set"}`,
      `Diet: ${data.diet_type ?? "balanced"}`,
      `Calories: ${data.target_calories ?? "not set"} kcal/day`,
      `Protein: ${data.protein_grams ?? "not set"} g`,
      `Carbs: ${data.carbs_grams ?? "not set"} g`,
      `Fat: ${data.fats_grams ?? "not set"} g`,
      `Water: ${data.water_liters ?? "not set"} L/day`,
      data.allergies?.length ? `Allergies: ${data.allergies.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return ok(text, { targets: data });
  },
});
