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
        (parsed.version === 1 || parsed.version === 2) &&
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
      // Strip malformed meal_suggestion attempts from chat text
      if (jsonString.includes('"meal_suggestion"')) {
        blocksToStrip.push(fullMatch);
      }
    }
  }

  // Strip closed blocks from display text first
  for (const block of blocksToStrip) {
    cleanText = cleanText.replace(block, "");
  }

  // 2) Unclosed / truncated blocks: ```json ... (no closing ```)
  //    Check AFTER stripping closed blocks so we don't false-positive.
  const unclosedIdx = cleanText.search(/```json\s/i);
  if (unclosedIdx !== -1) {
    const remainingBlock = cleanText.slice(unclosedIdx);
    // Strip if it looks like a meal_suggestion attempt
    if (remainingBlock.includes('"meal_suggestion"')) {
      const innerMatch = /```json\s*([\s\S]*)$/i.exec(remainingBlock);
      if (innerMatch) {
        const jsonString = innerMatch[1].trim();
        try {
          const parsed = JSON.parse(jsonString);
          if (
            parsed?.type === "meal_suggestion" &&
            (parsed?.version === 1 || parsed?.version === 2) &&
            parsed?.meal?.title
          ) {
            suggestions.push(parsed as MealSuggestion);
          }
        } catch {
          // Expected for truncated
        }
      }
      cleanText = cleanText.slice(0, unclosedIdx);
    }
  }

  // Collapse excessive whitespace left behind
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  if (!cleanText && suggestions.length === 0) {
    cleanText = "I had trouble formatting that meal suggestion — please send again.";
  }

  return { cleanText, suggestions };
}
