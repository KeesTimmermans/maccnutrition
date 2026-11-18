import { Lightbulb, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { loggedMealSlots, pickNextMealTip } from "@/lib/whatNext";

interface WhatNextCardProps {
  /** Local hour (0–23) each of today's meals was logged at. */
  loggedHours: number[];
  onAskCoach: (prefill: string) => void;
}

/** Habits-mode "What should I eat next?" card. Fixed, number-free tips; no AI call to render. */
export const WhatNextCard = ({ loggedHours, onAskCoach }: WhatNextCardProps) => {
  const { t } = useLanguage();
  const next = pickNextMealTip(new Date().getHours(), loggedHours.length, loggedMealSlots(loggedHours));

  return (
    <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t("what_next_title")}</p>
          <h3 className="font-semibold text-foreground">{t(next.headlineKey)}</h3>
          <p className="text-sm text-foreground">{t(next.tipKey)}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={() => onAskCoach(t("what_next_prefill"))}>
        <MessageCircle className="w-4 h-4 mr-1.5" />
        {t("what_next_button")}
      </Button>
    </div>
  );
};
