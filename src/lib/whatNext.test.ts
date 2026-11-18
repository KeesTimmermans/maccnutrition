import { describe, expect, it } from "vitest";
import { loggedMealSlots, pickNextMealTip } from "@/lib/whatNext";

describe("pickNextMealTip", () => {
  it("suggests breakfast in the morning when breakfast isn't logged", () => {
    const tip = pickNextMealTip(8, 0, []);
    expect(tip.id).toBe("breakfast");
    expect(tip.headline).toBe("No breakfast logged yet");
    expect(tip.tip).toBe("Start with a palm of protein and a piece of fruit.");
  });

  it("uses the plate method at lunchtime when lunch isn't logged", () => {
    const tip = pickNextMealTip(13, 1, ["breakfast"]);
    expect(tip.id).toBe("lunch");
    expect(tip.headline).toBe("No lunch logged yet");
    expect(tip.tip).toBe("Build your plate: half vegetables, a palm of protein, a fist of carbs, a thumb of fats.");
  });

  it("uses the evening plate method at dinner time when dinner isn't logged", () => {
    const tip = pickNextMealTip(18, 2, ["breakfast", "lunch"]);
    expect(tip.id).toBe("dinner");
    expect(tip.tipKey).toBe("what_next_tip_plate_evening");
  });

  it("gives the snack tip once every meal is logged", () => {
    const tip = pickNextMealTip(19, 3, ["breakfast", "lunch", "dinner"]);
    expect(tip.id).toBe("all_logged");
    expect(tip.tipKey).toBe("what_next_tip_snack");
  });

  it("gives the snack tip between meals and late at night", () => {
    expect(pickNextMealTip(9, 1, ["breakfast"]).id).toBe("between");
    expect(pickNextMealTip(23, 0, []).id).toBe("wind_down");
    expect(pickNextMealTip(23, 0, []).tipKey).toBe("what_next_tip_snack");
  });

  it("uses the checklist's meal slots for logged hours", () => {
    expect(loggedMealSlots([8, 10, 11, 15, 16])).toEqual(["breakfast", "lunch", "dinner"]);
  });
});
