// Pure TS (no Deno imports): re-reads search hits in batches until enough usable products are found.

export const ENRICH_BATCH_SIZE = 8;
export const ENRICH_TARGET = 12;
export const ENRICH_MAX_TRIED_GENERAL = 32;
export const ENRICH_MAX_TRIED_STORE = 12;

export async function enrichInBatches<T>(
  codes: string[],
  fetchOne: (code: string) => Promise<T | null>,
  opts: { target?: number; maxTried: number; batchSize?: number },
): Promise<T[]> {
  const target = opts.target ?? ENRICH_TARGET;
  const batchSize = opts.batchSize ?? ENRICH_BATCH_SIZE;
  const pool = codes.slice(0, opts.maxTried);
  const found: T[] = [];
  for (let i = 0; i < pool.length && found.length < target; i += batchSize) {
    const batch = pool.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((c) => fetchOne(c)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null && r.value !== undefined) found.push(r.value);
    }
  }
  return found.slice(0, target);
}
