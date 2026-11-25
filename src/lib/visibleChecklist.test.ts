import { describe, it, expect } from "vitest";
import { visibleChecklistItems, CHECKLIST_VISIBLE_MAX, type ChecklistItem, type ChecklistWhen } from "./dailyChecklist";

const item = (id: string, when: ChecklistWhen, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id, title: id, when, kind: "manual", source: "ai", category: "nutrition", ...extra,
});
const at = (h: number) => new Date(2026, 10, 25, h, 0, 0);
const list = [
  item("m", "morning"), item("b", "breakfast"), item("l", "lunch"), item("a", "afternoon"),
  item("d", "dinner"), item("e", "evening"), item("any", "anytime"), item("l2", "lunch"),
];
const none = () => false;
const ids = (xs: ChecklistItem[]) => xs.map((x) => x.id);

describe("visibleChecklistItems", () => {
  it("never shows more than 5", () => {
    expect(visibleChecklistItems(list, none, at(8)).visible).toHaveLength(CHECKLIST_VISIBLE_MAX);
  });
  it("keeps time-of-day order inside the result", () => {
    expect(ids(visibleChecklistItems(list, none, at(13)).visible)).toEqual(["l", "a", "d", "e", "l2"].sort((x, y) =>
      ["l", "l2", "a", "d", "e"].indexOf(x) - ["l", "l2", "a", "d", "e"].indexOf(y)));
  });
  it("excludes done items and lists them in done", () => {
    const r = visibleChecklistItems(list, (i) => i.id === "l", at(8));
    expect(ids(r.visible)).not.toContain("l");
    expect(ids(r.done)).toEqual(["l"]);
  });
  it("one tick brings in exactly one replacement", () => {
    const before = ids(visibleChecklistItems(list, none, at(8)).visible);
    const after = ids(visibleChecklistItems(list, (i) => i.id === before[0], at(8)).visible);
    expect(after).toHaveLength(5);
    expect(after.filter((x) => !before.includes(x))).toHaveLength(1);
  });
  it("puts late slots behind current ones at 08:00", () => {
    expect(ids(visibleChecklistItems(list, none, at(8)).visible)).toEqual(["b", "l", "l2", "a", "d"]);
  });
  it("puts late slots behind current ones at 13:00", () => {
    expect(ids(visibleChecklistItems(list, none, at(13)).visible)).toEqual(["l", "l2", "a", "d", "e"]);
  });
  it("at 21:00 evening and anytime come first, then late items", () => {
    expect(ids(visibleChecklistItems(list, none, at(21)).visible)).toEqual(["m", "b", "l", "e", "any"]);
  });
  it("never treats anytime as late", () => {
    const r = visibleChecklistItems([item("m1", "morning"), item("m2", "morning"), item("m3", "morning"), item("m4", "morning"), item("m5", "morning"), item("any", "anytime")], none, at(22));
    expect(ids(r.visible)).toContain("any");
  });
  it("weekly habit and up to 2 check-in items always get a seat", () => {
    const xs = [...list, item("h", "evening", { kind: "habit", source: "weekly_habit" }),
      item("ci-1", "anytime", { source: "checkin" }), item("ci-2", "anytime", { source: "checkin" }), item("ci-3", "anytime", { source: "checkin" })];
    const v = ids(visibleChecklistItems(xs, none, at(8)).visible);
    expect(v).toEqual(expect.arrayContaining(["h", "ci-1", "ci-2"]));
    expect(v).not.toContain("ci-3");
    expect(v).toHaveLength(5);
  });
  it("keeps grace items visible", () => {
    const r = visibleChecklistItems(list, (i) => i.id === "b", at(8), ["b"]);
    expect(ids(r.visible)).toContain("b");
    expect(ids(r.done)).not.toContain("b");
  });
  it("reports remaining open items not shown", () => {
    expect(visibleChecklistItems(list, none, at(8)).remaining).toBe(3);
  });
  it("is empty when everything is done", () => {
    const r = visibleChecklistItems(list, () => true, at(8));
    expect(r.visible).toEqual([]);
    expect(r.remaining).toBe(0);
    expect(r.done).toHaveLength(list.length);
  });
});
