import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "log_water",
  title: "Log water intake",
  description: "Log water intake in millilitres for the signed-in MacNutrition user.",
  inputSchema: {
    amount_ml: z.number().min(1).max(5000).describe("Amount of water in millilitres."),
    logged_at: z.string().optional().describe("ISO timestamp. Defaults to now."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ amount_ml, logged_at }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("water_intake")
      .insert({ user_id: ctx.getUserId(), amount_ml, ...(logged_at ? { logged_at } : {}) })
      .select()
      .single();

    if (error) return fail(error.message);
    return ok(`Logged ${amount_ml} ml of water.`, { entry: data });
  },
});
