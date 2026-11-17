import { describe, it, expect } from "vitest";
import { parseCoachText, parseInline } from "./CoachFormattedText";

describe("CoachFormattedText parsing", () => {
  it("turns #, ## and ### lines into headings without the hashes", () => {
    expect(parseCoachText("### Dinner idea\n## Plan\n# Today")).toEqual([
      { kind: "heading", segments: [{ text: "Dinner idea", bold: false }] },
      { kind: "heading", segments: [{ text: "Plan", bold: false }] },
      { kind: "heading", segments: [{ text: "Today", bold: false }] },
    ]);
  });

  it("turns *, - and • lines into bullets", () => {
    const blocks = parseCoachText("* Eggs\n- Toast\n• Spinach");
    expect(blocks.map((b) => b.kind)).toEqual(["bullet", "bullet", "bullet"]);
    expect(blocks[0]).toEqual({ kind: "bullet", segments: [{ text: "Eggs", bold: false }] });
  });

  it("renders **text** as bold", () => {
    expect(parseInline("Aim for **40g protein** tonight")).toEqual([
      { text: "Aim for ", bold: false },
      { text: "40g protein", bold: true },
      { text: " tonight", bold: false },
    ]);
  });

  it("removes a leftover unmatched **", () => {
    expect(parseInline("You have **650 kcal left")).toEqual([{ text: "You have 650 kcal left", bold: false }]);
  });

  it("turns blank lines into a single gap", () => {
    expect(parseCoachText("Hi\n\n\nThere").map((b) => b.kind)).toEqual(["text", "gap", "text"]);
  });
});
