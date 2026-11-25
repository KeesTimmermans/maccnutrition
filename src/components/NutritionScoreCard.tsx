import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { listScores, type StoredScore } from "@/lib/nutritionScoreService";
import { bandFor, daysUntilRetake, isRetakeUnlocked } from "@/lib/nutritionScore";
import { fill, formatDelta } from "@/components/nutritionScore/fill";

export function NutritionScoreCard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [scores, setScores] = useState<StoredScore[] | null>(null);

  useEffect(() => {
    listScores().then(setScores).catch(() => setScores(null));
  }, []);

  if (!scores) return null;
  const open = () => navigate("/nutrition-score");
  const latest = scores[0];

  if (!latest || isRetakeUnlocked(latest.takenAt, new Date())) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <p className="flex-1 font-semibold text-foreground text-sm">
          {t(latest ? "ns_card_unlocked" : "ns_card_get")}
        </p>
        <Button size="sm" onClick={open}>{t(latest ? "ns_card_unlocked_button" : "ns_card_get_button")}</Button>
      </Card>
    );
  }

  const prev = scores[1];
  const delta = prev ? latest.total - prev.total : null;
  return (
    <button onClick={open} className="block w-full text-left rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="bg-card rounded-3xl shadow-medium p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-primary">{latest.total}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">
            {t("ns_title")} · {t(`ns_band_${bandFor(latest.total).id}` as any)}
            {delta !== null && <span className="ml-2 text-sm text-muted-foreground">{formatDelta(delta)}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {fill(t("ns_card_days"), { n: daysUntilRetake(latest.takenAt, new Date()) })}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </Card>
    </button>
  );
}
