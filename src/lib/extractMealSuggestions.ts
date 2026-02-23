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
  const blocksToStrip: string[] = [];

  // 1) Closed blocks: ```json ... ```
  const closedBlockRegex = /```json\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = closedBlockRegex.exec(message)) !== null) {
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
          "[extractMealSuggestions] Failed to parse closed JSON block:",
          e instanceof Error ? e.message : e,
          "\nContent:",
          jsonString.slice(0, 200)
        );
      }
      // Still strip blocks that look like meal_suggestion attempts
      if (jsonString.includes('"meal_suggestion"')) {
        blocksToStrip.push(fullMatch);
      }
    }
  }

  // 2) Unclosed / truncated blocks: ```json ... (no closing ```)
  //    This happens when AI response is cut off by token limits.
  const unclosedBlockRegex = /```json\s*([\s\S]*?)$/gi;
  while ((match = unclosedBlockRegex.exec(message)) !== null) {
    const fullMatch = match[0];
    // Skip if this was already handled as a closed block
    if (blocksToStrip.includes(fullMatch)) continue;
    // Check if this region was already captured by a closed match
    const alreadyCaptured = blocksToStrip.some(b => message.indexOf(b) === message.indexOf(fullMatch));
    if (alreadyCaptured) continue;

    const jsonString = match[1].trim();

    // Try to parse (unlikely for truncated, but possible)
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed?.type === "meal_suggestion" && parsed?.version === 1 && parsed?.meal?.title) {
        suggestions.push(parsed as MealSuggestion);
        blocksToStrip.push(fullMatch);
        continue;
      }
    } catch {
      // Expected for truncated blocks
    }

    // Strip if it looks like a truncated meal_suggestion block
    if (jsonString.includes('"meal_suggestion"')) {
      blocksToStrip.push(fullMatch);
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
