/// <reference types="node" />
import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/** Supabase client scoped to the signed-in MCP caller (RLS applies as that user). */
export function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Connect your MacNutrition account first." }],
    isError: true,
  };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok(text: string, structuredContent?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], ...(structuredContent ? { structuredContent } : {}) };
}

/** Returns [startISO, endISO] for a YYYY-MM-DD day (UTC-based bounds). */
export function dayBounds(date?: string) {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  return [`${d}T00:00:00.000Z`, `${d}T23:59:59.999Z`, d] as const;
}
