import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, fail, ok } from "../supabase";

export default defineTool({
  name: "get_progress",
  title: "Get recent progress updates",
  description: "List the signed-in user's recent weight and progress check-ins from MacNutrition.",
  inputSchema: {
    limit: z.number().min(1).max(50).optional().describe("How many recent updates to return. Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("progress_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (error) return fail(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return ok("No progress updates logged yet.", { updates: [] });

    const lines = rows.map((r: Record<string, unknown>) => {
      const date = String(r.created_at ?? "").slice(0, 10);
      const weight = r.weight_kg ?? r.weight ?? null;
      return `- ${date}${weight ? `: ${weight} kg` : ""}`;
    });
    return ok(`Recent progress updates:\n${lines.join("\n")}`, { updates: rows });
  },
});
