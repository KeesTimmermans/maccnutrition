import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  AREAS, QUESTIONS, areaName, bandFor, compareScores, focusTip, goalScore, isComplete,
  isRetakeUnlocked, retakeUnlockAt, scoreAnswers, type Answers,
} from "@/lib/nutritionScore";
import { listScores, saveScore, type StoredScore } from "@/lib/nutritionScoreService";
import { trackNutritionScoreCompleted, trackNutritionScoreStarted } from "@/lib/analytics";
import { fill, formatDate, formatDelta } from "@/components/nutritionScore/fill";

type View = "loading" | "intro" | "quiz" | "results";

const NutritionScore = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [scores, setScores] = useState<StoredScore[]>([]);
  const [view, setView] = useState<View>("loading");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listScores()
      .then((s) => {
        setScores(s);
        setView(s[0] ? "results" : "intro");
      })
      .catch(() => {
        toast.error(t("ns_load_error"));
        setView("intro");
      });
  }, []);

  const start = () => {
    trackNutritionScoreStarted();
    setAnswers({});
    setStep(0);
    setView("quiz");
  };

  const finish = async () => {
    setSaving(true);
    try {
      const result = scoreAnswers(answers);
      const saved = await saveScore(answers, result);
      trackNutritionScoreCompleted({ total: result.total, band: result.band, focusArea: result.focusArea, isFirst: scores.length === 0 });
      setScores([saved, ...scores]);
      setView("results");
      window.scrollTo(0, 0);
    } catch {
      toast.error(t("ns_save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-5">
        <h1 className="text-2xl font-bold text-foreground pt-2">{t("ns_title")}</h1>
        {view === "intro" && (
          <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-4">
            <p className="text-foreground">{t("ns_intro")}</p>
            <Button className="w-full" onClick={start}>{t("ns_start")}</Button>
          </Card>
        )}
        {view === "quiz" && (
          <Quiz
            step={step}
            answers={answers}
            saving={saving}
            onAnswer={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))}
            onBack={() => (step === 0 ? setView(scores.length ? "results" : "intro") : setStep(step - 1))}
            onNext={() => {
              if (step < AREAS.length - 1) { setStep(step + 1); window.scrollTo(0, 0); }
              else finish();
            }}
          />
        )}
        {view === "results" && scores[0] && (
          <Results scores={scores} onRetake={start} onToday={() => navigate("/dashboard")} />
        )}
      </div>
    </AppLayout>
  );
};

function Quiz({ step, answers, saving, onAnswer, onBack, onNext }: {
  step: number; answers: Answers; saving: boolean;
  onAnswer: (id: string, v: number) => void; onBack: () => void; onNext: () => void;
}) {
  const { t } = useLanguage();
  const area = AREAS[step];
  const qs = QUESTIONS.filter((q) => q.area === area.id);
  const done = isComplete(answers, area.questionIds);
  const last = step === AREAS.length - 1;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{fill(t("ns_step"), { x: step + 1, y: AREAS.length })}</p>
        <h2 className="text-xl font-semibold text-foreground">{area.name}</h2>
      </div>
      {qs.map((q) => (
        <Card key={q.id} className="bg-card rounded-3xl shadow-medium p-4 space-y-3">
          <p className="font-medium text-foreground">{q.text}</p>
          <div className="space-y-2">
            {q.options.map((label, i) => {
              const v = i + 1;
              const selected = answers[q.id] === v;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onAnswer(q.id, v)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>{t("ns_back")}</Button>
        <Button className="flex-1" disabled={!done || saving} onClick={onNext}>
          {saving ? t("ns_saving") : t(last ? "ns_finish" : "ns_next")}
        </Button>
      </div>
    </div>
  );
}

function Results({ scores, onRetake, onToday }: { scores: StoredScore[]; onRetake: () => void; onToday: () => void }) {
  const { t } = useLanguage();
  const latest = scores[0];
  const prev = scores[1];
  const diff = prev ? compareScores(prev, latest) : null;
  const unlock = retakeUnlockAt(latest.takenAt);
  const unlocked = isRetakeUnlocked(latest.takenAt, new Date());
  const history = [...scores].reverse().map((s) => ({ date: s.takenAt.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }), score: s.total }));

  return (
    <div className="space-y-4">
      <Card className="bg-card rounded-3xl shadow-medium p-5 text-center space-y-1">
        <p className="text-sm text-muted-foreground">{t("ns_your_score")}</p>
        <p className="text-6xl font-bold text-primary">{latest.total}</p>
        <p className="font-semibold text-foreground">{t(`ns_band_${bandFor(latest.total).id}` as any)}</p>
        {diff && <p className="text-sm text-muted-foreground">{t("ns_change_since")}: {formatDelta(diff.overall)}</p>}
      </Card>

      <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-3">
        {AREAS.map((a) => (
          <div key={a.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">{a.name}</span>
              <span className="text-muted-foreground">
                {latest.areas[a.id]}
                {diff && <span className="ml-2">({formatDelta(diff.areas[a.id])})</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${latest.areas[a.id]}%` }} />
            </div>
          </div>
        ))}
      </Card>

      <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-2">
        <p className="text-sm text-muted-foreground">{t("ns_focus_title")}</p>
        <p className="font-semibold text-foreground">{areaName(latest.focusArea)}</p>
        <p className="text-foreground">{focusTip(latest.focusArea, scores.length)}</p>
        <p className="text-sm font-medium text-primary">
          {fill(t("ns_aim_for"), { score: goalScore(latest.total), date: formatDate(unlock) })}
        </p>
      </Card>

      {scores.length >= 2 && (
        <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-2">
          <p className="font-semibold text-foreground">{t("ns_history")}</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} stroke="hsl(var(--muted-foreground))" />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {unlocked ? (
        <Button className="w-full" onClick={onRetake}>{t("ns_retake")}</Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{fill(t("ns_next_checkin_on"), { date: formatDate(unlock) })}</p>
      )}
      <Button variant="outline" className="w-full" onClick={onToday}>{t("ns_back_today")}</Button>
    </div>
  );
}

export default NutritionScore;
