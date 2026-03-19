import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, TrendingUp, Droplets, Settings, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserBaseline } from "@/lib/userService";
import { getActiveCompPrep, recalculateCompPrep, deactivateCompPrep, getCheckins } from "@/lib/competitionPrep/service";
import { calculateCompetitionPrep } from "@/lib/competitionPrep/engine";
import { EVENT_LABELS } from "@/lib/competitionPrep/eventProfiles";
import type { CompetitionPrepResult, EventType } from "@/lib/competitionPrep/types";
import type { StoredCompPrep, StoredCheckin } from "@/lib/competitionPrep/service";
import { CompetitionCheckinDialog } from "@/components/CompetitionCheckinDialog";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

const CompetitionPrep = () => {
  const [prep, setPrep] = useState<StoredCompPrep | null>(null);
  const [result, setResult] = useState<CompetitionPrepResult | null>(null);
  const [checkins, setCheckins] = useState<StoredCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckin, setShowCheckin] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadPrep = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const activePrep = await getActiveCompPrep();
      if (!activePrep) {
        setPrep(null);
        setResult(null);
        setLoading(false);
        return;
      }

      setPrep(activePrep);

      // Recalculate with current data
      const baseline = await getUserBaseline(user.id);
      if (baseline?.weight && baseline?.tdee) {
        const weightKg = baseline.unit_system === "imperial"
          ? baseline.weight / 2.205
          : baseline.weight;

        const freshResult = calculateCompetitionPrep({
          eventType: activePrep.event_type as EventType,
          eventDate: activePrep.event_date,
          primaryGoal: activePrep.primary_goal as any,
          goalWeight: activePrep.goal_weight ?? undefined,
          weightKg,
          tdee: baseline.tdee,
        });
        setResult(freshResult);
      }

      const ci = await getCheckins(activePrep.id);
      setCheckins(ci);
    } catch (err) {
      console.error("Failed to load comp prep:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPrep(); }, [loadPrep]);

  const handleDeactivate = async () => {
    if (!prep) return;
    await deactivateCompPrep(prep.id);
    toast({ title: "Competition Prep deactivated" });
    setPrep(null);
    setResult(null);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  // No active prep → show CTA
  if (!prep || !result) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 pt-8 space-y-6">
          <div className="text-center space-y-4">
            <Trophy className="h-16 w-16 text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Competition Prep Mode</h1>
            <p className="text-muted-foreground">
              Set up an event-specific nutrition plan that automatically adjusts based on your timeline, event demands, and weekly progress.
            </p>
            <Button size="lg" onClick={() => navigate("/competition-prep/setup")}>
              <Plus className="mr-2 h-5 w-5" /> Start Competition Prep
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const eventLabel = EVENT_LABELS[prep.event_type as EventType] || prep.event_type;

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Competition Prep</h1>
              <p className="text-xs text-muted-foreground">{eventLabel} · {prep.division}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDeactivate} title="End prep">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Countdown */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                {new Date(prep.event_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <p className="text-4xl font-bold text-primary">{result.weeksOut}</p>
            <p className="text-sm text-muted-foreground">weeks to go</p>
          </CardContent>
        </Card>

        {/* Phase & Mode */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Phase</p>
              <p className="font-semibold text-sm text-foreground">{result.phaseLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mode</p>
              <p className="font-semibold text-sm text-foreground">{result.modeLabel}</p>
            </CardContent>
          </Card>
        </div>

        {/* Targets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Targets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-foreground">{result.calories}</p>
                <p className="text-[10px] text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{result.protein}g</p>
                <p className="text-[10px] text-muted-foreground">Protein</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{result.carbs}g</p>
                <p className="text-[10px] text-muted-foreground">Carbs</p>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{result.fats}g</p>
                <p className="text-[10px] text-muted-foreground">Fats</p>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-2">
              <span>Training day: {result.trainingDayCalories} kcal</span>
              <span>Rest day: {result.restDayCalories} kcal</span>
            </div>
          </CardContent>
        </Card>

        {/* Projected weight */}
        {result.projectedEventWeight && (
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Projected Event-Day Weight</p>
                <p className="font-semibold text-foreground">
                  {result.projectedEventWeight.low}–{result.projectedEventWeight.high} kg
                </p>
                {result.weightLossRatePct && (
                  <p className="text-[10px] text-muted-foreground">
                    Target rate: {result.weightLossRatePct.toFixed(2)}%/week
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goal weight warning */}
        {result.goalWeightWarning && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-3 pb-3">
              <p className="text-sm text-destructive">{result.goalWeightWarning}</p>
            </CardContent>
          </Card>
        )}

        {/* Priorities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Priorities</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1">
              {result.priorities.map((p, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-primary font-bold">{i + 1}.</span> {p}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Explanation */}
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Why Your Plan Changed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{result.explanation}</p>
          </CardContent>
        </Card>

        {/* Taper / race week guidance */}
        {result.taperGuidance && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-primary">
                {result.phase === "race_week" ? "🏁 Race Week Guidance" : "📉 Taper Guidance"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {result.taperGuidance.map((t, i) => (
                  <li key={i} className="text-sm text-foreground">• {t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Hydration notes */}
        {result.hydrationNotes && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" /> Hydration Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {result.hydrationNotes.map((h, i) => (
                  <li key={i} className="text-sm text-foreground">• {h}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Weekly check-in CTA */}
        <Button className="w-full" onClick={() => setShowCheckin(true)}>
          Submit Weekly Check-In
        </Button>

        {/* Check-in history */}
        {checkins.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Check-In History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checkins.map((ci) => (
                <div key={ci.id} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">Week {ci.week_number}</span>
                  <span className="text-foreground font-medium">{ci.avg_weight ? `${ci.avg_weight} kg` : "—"}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(ci.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Check-in dialog */}
        {showCheckin && prep && (
          <CompetitionCheckinDialog
            prepId={prep.id}
            weekNumber={checkins.length + 1}
            onClose={() => setShowCheckin(false)}
            onSubmitted={() => {
              setShowCheckin(false);
              loadPrep();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CompetitionPrep;
