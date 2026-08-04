import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Extracts a human-readable error message from a Supabase edge function error.
 * Falls back to the error's own message when no structured body is available.
 */
export async function getEdgeFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
