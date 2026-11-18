import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SCORING_GUIDE } from "@/lib/foodScore";
import { BAND_STYLES } from "@/components/scanRate/bandStyles";

/** Fills {name} placeholders in a translated string. */
const fill = (text: string, values: Record<string, number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text);

/** "How scores work": every line comes from SCORING_GUIDE, so it always matches the scoring rules. */
const ScoringGuide = () => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="p-4 space-y-5">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground pt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("scan_rate_back")}
        </Link>

        <header>
          <h1 className="text-2xl font-bold text-foreground">{t("tool_scoring_name")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("scoring_guide_intro")}</p>
        </header>

        <Section title={t("scoring_guide_pillars_title")}>
          <ul className="space-y-4">
            {SCORING_GUIDE.pillars.map((p) => (
              <li key={p.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{t(p.labelKey)}</span>
                  <Tag strong={p.countsDouble}>
                    {t(p.countsDouble ? "scoring_guide_counts_double" : "scoring_guide_counts_once")}
                  </Tag>
                  {p.foodsOnly && <Tag>{t("scoring_guide_foods_only")}</Tag>}
                </div>
                <p className="text-sm text-muted-foreground">{t(p.descriptionKey)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("scoring_guide_drinks_title")}>
          <p className="text-sm text-muted-foreground">{t(SCORING_GUIDE.drinksKey)}</p>
          <p className="text-sm text-muted-foreground">{t(SCORING_GUIDE.juiceKey)}</p>
        </Section>

        <Section title={t("scoring_guide_caps_title")}>
          <p className="text-sm text-muted-foreground">{t("scoring_guide_caps_intro")}</p>
          <ul className="space-y-2 list-disc pl-5">
            {SCORING_GUIDE.caps.map((c) => (
              <li key={c.id} className="text-sm text-foreground">
                {fill(t(c.textKey), c.values)}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("scoring_guide_bands_title")}>
          <ul className="space-y-2">
            {SCORING_GUIDE.bands.map((b) => {
              const style = BAND_STYLES[b.band];
              return (
                <li key={b.band} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3", style.bg)}>
                  <span className={cn("w-14 shrink-0 text-lg font-bold tabular-nums", style.text)}>
                    {b.min}–{b.max}
                  </span>
                  <span className={cn("font-semibold", style.text)}>{t(b.key)}</span>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title={t("scoring_guide_notes_title")}>
          <ul className="space-y-2 list-disc pl-5">
            {SCORING_GUIDE.noteKeys.map((k) => (
              <li key={k} className="text-sm text-muted-foreground">
                {t(k)}
              </li>
            ))}
            {SCORING_GUIDE.floors.map((f) => (
              <li key={f.kind} className="text-sm text-muted-foreground">
                {fill(t(f.textKey), f.values)}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </AppLayout>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-3">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {children}
    </Card>
  );
}

function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        strong ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export default ScoringGuide;
