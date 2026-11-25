import { describe, it, expect } from "vitest";
import { enrichInBatches, ENRICH_MAX_TRIED_GENERAL, ENRICH_MAX_TRIED_STORE } from "../../supabase/functions/_shared/offEnrich";

const codes = (n: number) => Array.from({ length: n }, (_, i) => String(i));

describe("enrichInBatches", () => {
  it("stops once 12 usable products are found, in batches of 8", async () => {
    const tried: string[] = [];
    const r = await enrichInBatches(codes(40), async (c) => { tried.push(c); return c; }, { maxTried: ENRICH_MAX_TRIED_GENERAL });
    expect(r).toHaveLength(12);
    expect(tried).toHaveLength(16);
  });
  it("tries at most 32 hits when few are usable", async () => {
    const tried: string[] = [];
    const r = await enrichInBatches(codes(50), async (c) => { tried.push(c); return Number(c) % 4 === 0 ? c : null; }, { maxTried: ENRICH_MAX_TRIED_GENERAL });
    expect(tried).toHaveLength(32);
    expect(r).toHaveLength(8);
  });
  it("store search tries at most 12", async () => {
    const tried: string[] = [];
    await enrichInBatches(codes(50), async (c) => { tried.push(c); return null; }, { maxTried: ENRICH_MAX_TRIED_STORE });
    expect(tried).toHaveLength(12);
  });
  it("skips failed reads", async () => {
    const r = await enrichInBatches(codes(3), async (c) => { if (c === "1") throw new Error("x"); return c; }, { maxTried: 32 });
    expect(r).toEqual(["0", "2"]);
  });
});
