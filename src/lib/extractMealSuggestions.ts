import type { MealSuggestion } from "@/components/CoachMealSuggestionCard";

export interface ExtractedMealSuggestions {
  cleanText: string;
  suggestions: MealSuggestion[];
}

/**
 * Build a fallback meal suggestion from plain-text "What to log" sections
 * when JSON is missing/malformed.
 */
function buildSuggestionFromWhatToLog(text: string): MealSuggestion | null {
  const hasWhatToLog = /what\s+to\s+log\s*:?/i.test(text);
  if (!hasWhatToLog) return null;

  const sectionStart = text.search(/what\s+to\s+log\s*:?/i);
  if (sectionStart === -1) return null;

  const section = text.slice(sectionStart);
  const lines = section
    .split("\n")
    .map((l) => l.replace(/^\s*[*•\-]\s*/, "").trim())
    .filter(Boolean)
    .filter((l) => !/^what\s+to\s+log\s*:?$/i.test(l));

  const parsed = lines
    .map((line) => {
      const m = line.match(/^(.*?)\s*[—-]\s*([0-9]+(?:\.[0-9]+)?)\s*(g|ml|count)?\b/i);
      if (!m) return null;
      const ingredient = m[1].replace(/^\*+|\*+$/g, "").trim();
      const quantity = Number(m[2]);
      const unit = (m[3] || "g").toLowerCase();

      if (!ingredient || !Number.isFinite(quantity) || quantity <= 0) return null;
      return {
        ingredient,
        quantity,
        unit,
        amount: `${quantity}${unit}`,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (parsed.length === 0) return null;

  const titleMatch = text.match(/^\s*\*\*(.+?)\*\*\s*$/m);
  const title = titleMatch?.[1]?.trim() || "Coach meal suggestion";

  return {
    type: "meal_suggestion",
    version: 2,
    meal: {
      title,
      servings: 1,
      prep_minutes: 0,
      cook_minutes: 0,
      ingredients: parsed.map((p) => ({ item: p.ingredient, amount: p.amount })),
      instructions: [],
      notes: [],
      estimated_macros: {
        calories: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      },
      log_payload: parsed.map((p) => ({
        ingredient: p.ingredient,
        quantity: p.quantity,
        unit: p.unit,
      })),
    },
  };
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
        (typeof parsed.version === "number" || parsed.version === undefined) &&
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
    if (remainingBlock.includes('"meal_suggestion"')) {
      const innerMatch = /```json\s*([\s\S]*)$/i.exec(remainingBlock);
      if (innerMatch) {
        const jsonString = innerMatch[1].trim();
        try {
          const parsed = JSON.parse(jsonString);
          if (
            parsed?.type === "meal_suggestion" &&
            (typeof parsed?.version === "number" || parsed?.version === undefined) &&
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

  // 3) Fallback: build a suggestion from plain-text "What to log" content
  if (suggestions.length === 0) {
    const fallback = buildSuggestionFromWhatToLog(cleanText);
    if (fallback) {
      suggestions.push(fallback);
    }
  }

  // Collapse excessive whitespace left behind
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  if (!cleanText && suggestions.length === 0) {
    cleanText = "I had trouble formatting that meal suggestion — please send again.";
  }

  return { cleanText, suggestions };
}
