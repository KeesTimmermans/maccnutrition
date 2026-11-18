import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  bandForScore,
  capLineKey,
  FLOOR_LINE_KEYS,
  WEAKEST_LINK_THRESHOLD,
  type PillarResult,
  type ProductScoreResult,
} from "@/lib/foodScore";
import { BAND_STYLES } from "./bandStyles";

/** "How we scored this": pillar rows, average, any cap that lowered the score, final score. */
export function ScoreBreakdown({ result }: { result: ProductScoreResult }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (result.score === null || result.average === null) return null;
  // The grain cap comes after the floors, so its line goes after the floor line.
  const capLines = result.caps.filter((c) => c.applied && c.id !== "grain_staple");
  const grainLine = result.caps.find((c) => c.applied && c.id === "grain_staple");
  const anyUnknown = result.pillars.some((p) => p.applicable && !p.known);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl bg-muted/50">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {t("score_how_title")}
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">
        <ul className="space-y-3">
          {result.pillars.map((p) => (
            <PillarRow key={p.id} pillar={p} />
          ))}
        </ul>

        {(result.provisional || anyUnknown) && (
          <p className="text-xs text-muted-foreground">{t("score_provisional_line")}</p>
        )}

        <div className="border-t border-border pt-3 space-y-1 text-sm">
          <p className="text-muted-foreground tabular-nums">
            {t("score_average").replace("{value}", result.average.toFixed(1))}
          </p>
          {capLines.map((c) => (
            <p key={c.id} className="text-muted-foreground">
              {t(capLineKey(c))
                .replace("{limit}", String(c.limit))
                .replace("{threshold}", String(WEAKEST_LINK_THRESHOLD))}
            </p>
          ))}
          {result.floor?.applied && (
            <p className="text-muted-foreground">
              {t(FLOOR_LINE_KEYS[result.floorKind ?? "whole_food"]).replace("{limit}", String(result.floor.limit))}
            </p>
          )}
          {grainLine && (
            <p className="text-muted-foreground">{t(capLineKey(grainLine)).replace("{limit}", String(grainLine.limit))}</p>
          )}
          <p className="font-semibold text-foreground tabular-nums">
            {t("score_final").replace("{score}", String(result.score))}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PillarRow({ pillar }: { pillar: PillarResult }) {
  const { t } = useLanguage();
  const shown = pillar.applicable && pillar.known;
  const band = BAND_STYLES[bandForScore(pillar.score)];

  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground">{t(pillar.labelKey)}</span>
          {pillar.weight > 1 && (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("score_counts_double")}
            </span>
          )}
        </div>
        {shown ? (
          <span className={cn("text-sm font-semibold tabular-nums", band.text)}>{pillar.score}</span>
        ) : (
          <span className="text-xs text-muted-foreground text-right">
            {pillar.applicable ? t("score_not_enough_data") : t("score_not_for_drinks")}
          </span>
        )}
      </div>
      {shown && (
        <div className="h-1.5 w-full rounded-full bg-background overflow-hidden" aria-hidden="true">
          <div className={cn("h-full rounded-full", band.bar)} style={{ width: `${pillar.score * 10}%` }} />
        </div>
      )}
      {shown && pillar.noteKeys.length > 0 && (
        <p className="text-xs text-muted-foreground">{pillar.noteKeys.map((k) => t(k)).join(" · ")}</p>
      )}
    </li>
  );
}
