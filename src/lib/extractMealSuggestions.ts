import type { MealSuggestion } from "@/components/CoachMealSuggestionCard";

export interface ExtractedMealSuggestions {
  cleanText: string;
  suggestions: MealSuggestion[];
}

/**
 * Extracts all valid meal_suggestion JSON blocks from an assistant message.
 * Returns the cleaned text (blocks stripped) and an array of parsed suggestions.
 * Fails gracefully — never throws.
 */
export function extractMealSuggestions(message: string): ExtractedMealSuggestions {
  const suggestions: MealSuggestion[] = [];
  let cleanText = message;

  // Tolerant regex: matches ```json ... ``` across newlines, case-insensitive
  const jsonBlockRegex = /```json\s*([\s\S]*?)```/gi;
  // Collect all matches first (to avoid mutating while iterating)
  const blocksToStrip: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(message)) !== null) {
    const fullMatch = match[0];
    const jsonString = match[1].trim();

    try {
      const parsed = JSON.parse(jsonString);
      if (
        parsed &&
        parsed.type === "meal_suggestion" &&
        parsed.version === 1 &&
        parsed.meal?.title
      ) {
        suggestions.push(parsed as MealSuggestion);
        blocksToStrip.push(fullMatch);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn(
          "[extractMealSuggestions] Failed to parse JSON block:",
          e instanceof Error ? e.message : e,
          "\nContent:",
          jsonString.slice(0, 200)
        );
      }
      // Still strip blocks that look like meal_suggestion attempts to avoid raw JSON in UI
      if (jsonString.includes('"meal_suggestion"')) {
        blocksToStrip.push(fullMatch);
      }
    }
  }

  // Strip matched blocks from display text
  for (const block of blocksToStrip) {
    cleanText = cleanText.replace(block, "");
  }

  // Collapse excessive whitespace left behind
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  return { cleanText, suggestions };
}
