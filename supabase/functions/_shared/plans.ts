// Single source for membership plans, prices and trial length.
// Pure TS (no Deno imports): shared by edge functions, the app and vitest.

export const TRIAL_DAYS = 14;

export type PlanId = "monthly" | "yearly";
export type PlanInterval = "month" | "year";

export interface Plan {
  priceId: string;
  pence: number;
  interval: PlanInterval;
}

export const PLANS: Record<PlanId, Plan> = {
  monthly: { priceId: "price_1SgrQ5EhSXv7TD1NMX0Yqbt8", pence: 999, interval: "month" },
  yearly: { priceId: "price_1UfdMsEhSXv7TD1NPtUURVAN", pence: 8999, interval: "year" },
};

export const DEFAULT_PLAN: PlanId = "monthly";

export function planFromInterval(interval: PlanInterval): PlanId;
export function planFromInterval(interval: string | null | undefined): PlanId | null;
export function planFromInterval(interval: string | null | undefined): PlanId | null {
  if (interval === "month") return "monthly";
  if (interval === "year") return "yearly";
  return null;
}

/** Validates the optional `plan` field of a create-checkout body. */
export function parsePlan(value: unknown): { ok: true; plan: PlanId } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, plan: DEFAULT_PLAN };
  if (value === "monthly" || value === "yearly") return { ok: true, plan: value };
  return { ok: false, error: 'plan must be "monthly" or "yearly"' };
}

export const yearlyPerMonthPence = (): number => Math.round(PLANS.yearly.pence / 12);
export const yearlySavingPence = (): number => PLANS.monthly.pence * 12 - PLANS.yearly.pence;
export const yearlySavingPercent = (): number =>
  Math.round((yearlySavingPence() / (PLANS.monthly.pence * 12)) * 100);

export const formatGbp = (pence: number): string => `£${(pence / 100).toFixed(2)}`;

export const planPriceLabel = (plan: PlanId): string =>
  `${formatGbp(PLANS[plan].pence)}/${PLANS[plan].interval}`;
