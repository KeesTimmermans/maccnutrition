import { describe, it, expect } from "vitest";
import { extractMealSuggestions } from "./extractMealSuggestions";

const validBlock = `\`\`\`json
{
  "type": "meal_suggestion",
  "version": 1,
  "meal": {
    "title": "Greek Yogurt Bowl",
    "servings": 1,
    "prep_minutes": 5,
    "cook_minutes": 0,
    "ingredients": [{"item": "Greek yogurt", "amount": "200g"}],
    "instructions": ["Mix it"],
    "notes": [],
    "estimated_macros": { "calories": 150, "protein_g": 20, "carbs_g": 10, "fat_g": 3 }
  }
}
\`\`\``;

describe("extractMealSuggestions", () => {
  it("extracts a single valid meal_suggestion block", () => {
    const message = `Here's a quick snack idea:\n\n${validBlock}\n\nLet me know!`;
    const { cleanText, suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].meal.title).toBe("Greek Yogurt Bowl");
    expect(cleanText).not.toContain("meal_suggestion");
    expect(cleanText).toContain("Here's a quick snack idea:");
    expect(cleanText).toContain("Let me know!");
  });

  it("returns empty suggestions for messages without JSON", () => {
    const { cleanText, suggestions } = extractMealSuggestions("Just eat more protein.");
    expect(suggestions).toHaveLength(0);
    expect(cleanText).toBe("Just eat more protein.");
  });

  it("handles malformed JSON gracefully", () => {
    const message = "Try this:\n\n```json\n{ broken json\n```\n\nEnjoy!";
    const { cleanText, suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(0);
    expect(cleanText).toContain("Enjoy!");
  });

  it("handles JSON block at the very end", () => {
    const message = `Great choice!\n${validBlock}`;
    const { suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(1);
  });

  it("handles JSON block at the very start", () => {
    const message = `${validBlock}\nHope you enjoy it!`;
    const { suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(1);
  });

  it("ignores non-meal_suggestion JSON blocks", () => {
    const message = '```json\n{"type": "other", "data": 123}\n```\n\nHello!';
    const { cleanText, suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(0);
    // Non-meal JSON blocks are kept
    expect(cleanText).toContain('"other"');
  });

  it("supports multiple meal_suggestion blocks", () => {
    const block2 = validBlock.replace("Greek Yogurt Bowl", "Protein Shake");
    const message = `Option 1:\n${validBlock}\n\nOption 2:\n${block2}`;
    const { suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(2);
  });

  it("strips malformed meal_suggestion attempts", () => {
    const message = '```json\n{"type":"meal_suggestion", bad\n```\nTry again.';
    const { cleanText, suggestions } = extractMealSuggestions(message);
    expect(suggestions).toHaveLength(0);
    expect(cleanText).not.toContain("meal_suggestion");
  });
});
