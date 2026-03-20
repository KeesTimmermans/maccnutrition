import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar, Trophy, Target, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getUserBaseline } from "@/lib/userService";
import { createCompPrep } from "@/lib/competitionPrep/service";
import { calculateCompetitionPrep } from "@/lib/competitionPrep/engine";
import { EVENT_LABELS, EVENT_DIVISIONS, FALLBACK_DIVISIONS } from "@/lib/competitionPrep/eventProfiles";
import type { EventType, CompGoal, CompetitionPrepResult } from "@/lib/competitionPrep/types";

const GOAL_OPTIONS: { value: CompGoal; label: string; icon: string }[] = [
  { value: "lose_weight", label: "Lose Weight", icon: "🔥" },
  { value: "improve_performance", label: "Improve Performance", icon: "⚡" },
  { value: "build_strength", label: "Build Strength", icon: "💪" },
  { value: "improve_endurance", label: "Improve Endurance", icon: "🏃" },
  { value: "recomp", label: "Body Recomposition", icon: "🔄" },
  { value: "maintain_and_peak", label: "Maintain & Peak", icon: "🎯" },
];

const CompetitionPrepSetup = () => {
  const [step, setStep] = useState(0);
  const [eventType, setEventType] = useState<EventType | "">("");
  const [eventDate, setEventDate] = useState("");
  const [division, setDivision] = useState("");
  const [customDivision, setCustomDivision] = useState("");
  const [goal, setGoal] = useState<CompGoal | "">("");
  const [goalWeight, setGoalWeight] = useState("");
  const [preview, setPreview] = useState<CompetitionPrepResult | null>(null);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePreview = async () => {
    if (!user || !eventType || !eventDate || !goal) return;

    try {
      const baseline = await getUserBaseline(user.id);
      if (!baseline?.weight || !baseline?.tdee) {
        toast({ title: "Missing profile data", description: "Please complete your profile first.", variant: "destructive" });
        return;
      }

      const weightKg = baseline.unit_system === "imperial"
        ? (baseline.weight / 2.205)
        : baseline.weight;

      const result = calculateCompetitionPrep({
        eventType,
        eventDate,
        primaryGoal: goal,
        goalWeight: goalWeight ? parseFloat(goalWeight) : undefined,
        weightKg,
        tdee: baseline.tdee,
      });

      setPreview(result);
      setStep(3);
    } catch {
      toast({ title: "Error", description: "Could not calculate prep plan.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!user || !eventType || !eventDate || !goal) return;
    setSaving(true);

    try {
      const baseline = await getUserBaseline(user.id);
      if (!baseline?.weight || !baseline?.tdee) throw new Error("Missing baseline");

      const weightKg = baseline.unit_system === "imperial"
        ? (baseline.weight / 2.205)
        : baseline.weight;

      await createCompPrep(
        {
          eventType,
          eventDate,
          division,
          customDivision: division === "custom" ? customDivision : undefined,
          primaryGoal: goal,
          goalWeight: goalWeight ? parseFloat(goalWeight) : undefined,
        },
        weightKg,
        baseline.tdee,
      );

      toast({ title: "Competition Prep activated!", description: "Your plan is ready." });
      navigate("/competition-prep");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not save.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Competition Prep</h1>
            <p className="text-sm text-muted-foreground">Set up your event-specific nutrition plan</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* Step 0: Event Type */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Your Event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(EVENT_LABELS) as EventType[]).map((et) => (
                <button
                  key={et}
                  onClick={() => {
                    setEventType(et);
                    setDivision("");
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    eventType === et
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <span className="font-semibold">{EVENT_LABELS[et]}</span>
                </button>
              ))}
              <Button onClick={() => setStep(1)} disabled={!eventType} className="w-full mt-4">
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Event Details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Division / Category</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(Object.keys(DIVISION_LABELS) as CompDivision[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDivision(d)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                        division === d
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {DIVISION_LABELS[d]}
                    </button>
                  ))}
                </div>
                {division === "custom" && (
                  <Input
                    placeholder="Enter custom division..."
                    value={customDivision}
                    onChange={(e) => setCustomDivision(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(2)} disabled={!eventDate} className="flex-1">
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" /> Your Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoal(g.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${
                    goal === g.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <span className="text-xl">{g.icon}</span>
                  <span className="font-medium">{g.label}</span>
                </button>
              ))}

              {(goal === "lose_weight" || goal === "recomp") && (
                <div className="mt-3">
                  <Label>Goal Weight (optional, kg)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 82"
                    value={goalWeight}
                    onChange={(e) => setGoalWeight(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handlePreview} disabled={!goal} className="flex-1">
                  Preview Plan <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {step === 3 && preview && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Competition Prep Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Phase & Mode */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Phase</p>
                    <p className="font-semibold text-foreground text-sm">{preview.phaseLabel}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50 border border-accent">
                    <p className="text-xs text-muted-foreground">Mode</p>
                    <p className="font-semibold text-foreground text-sm">{preview.modeLabel}</p>
                  </div>
                </div>

                {/* Countdown */}
                <div className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold text-foreground">{preview.weeksOut}</p>
                  <p className="text-xs text-muted-foreground">weeks until {eventType && EVENT_LABELS[eventType]}</p>
                </div>

                {/* Targets */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Daily Calories</p>
                    <p className="text-lg font-bold text-foreground">{preview.calories}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Training: {preview.trainingDayCalories} · Rest: {preview.restDayCalories}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="text-lg font-bold text-foreground">{preview.protein}g</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="text-lg font-bold text-foreground">{preview.carbs}g</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Fats</p>
                    <p className="text-lg font-bold text-foreground">{preview.fats}g</p>
                  </div>
                </div>

                {/* Weight projection */}
                {preview.projectedEventWeight && (
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">Projected Event-Day Weight</p>
                    <p className="font-semibold text-foreground">
                      {preview.projectedEventWeight.low}–{preview.projectedEventWeight.high} kg
                    </p>
                    {preview.weightLossRatePct && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Target rate: {preview.weightLossRatePct.toFixed(2)}% per week
                      </p>
                    )}
                  </div>
                )}

                {/* Goal weight warning */}
                {preview.goalWeightWarning && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{preview.goalWeightWarning}</p>
                  </div>
                )}

                {/* Priorities */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Current Priorities</p>
                  <ol className="space-y-1">
                    {preview.priorities.map((p, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="text-primary font-bold">{i + 1}.</span> {p}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Explanation */}
                <div className="p-3 rounded-lg bg-muted border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Why this plan</p>
                  <p className="text-sm text-foreground">{preview.explanation}</p>
                </div>

                {/* Taper guidance */}
                {preview.taperGuidance && (
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <p className="text-xs font-semibold text-primary mb-2">
                      {preview.phase === "race_week" ? "Race Week Guidance" : "Taper Guidance"}
                    </p>
                    <ul className="space-y-1">
                      {preview.taperGuidance.map((t, i) => (
                        <li key={i} className="text-sm text-foreground">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Activating..." : "Activate Prep Plan"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitionPrepSetup;
