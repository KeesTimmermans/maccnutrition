import type { ScoreBand } from "@/lib/foodScore";

export const BAND_STYLES: Record<ScoreBand, { text: string; bg: string; key: string }> = {
  good: { text: "text-score-good", bg: "bg-score-good/10", key: "score_band_good" },
  balance: { text: "text-score-balance", bg: "bg-score-balance/10", key: "score_band_balance" },
  occasional: { text: "text-score-occasional", bg: "bg-score-occasional/10", key: "score_band_occasional" },
};
