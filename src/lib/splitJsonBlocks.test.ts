import { describe, it, expect } from "vitest";
import { splitJsonBlocks } from "./splitJsonBlocks";

const card = '```json\n{"type":"meal_suggestion","meal":{"title":"Oats"}}\n```';

describe("splitJsonBlocks", () => {
  it("separates prose from a meal card block", () => {
    const { text, blocks } = splitJsonBlocks(`Try this breakfast.\n\n${card}`);
    expect(text).toBe("Try this breakfast.");
    expect(blocks).toEqual([card]);
  });

  it("returns empty text when the message is only a meal card", () => {
    const { text, blocks } = splitJsonBlocks(card);
    expect(text).toBe("");
    expect(blocks).toHaveLength(1);
  });

  it("returns no blocks for plain text", () => {
    expect(splitJsonBlocks("Drink more water.")).toEqual({ text: "Drink more water.", blocks: [] });
  });
});
