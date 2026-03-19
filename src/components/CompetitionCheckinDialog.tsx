import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getUserBaseline } from "@/lib/userService";
import { submitCheckin } from "@/lib/competitionPrep/service";
import type { WeeklyCheckinInput } from "@/lib/competitionPrep/types";

interface Props {
  prepId: string;
  weekNumber: number;
  onClose: () => void;
  onSubmitted: () => void;
}

const SCALE_OPTIONS = [1, 2, 3, 4, 5];
const TREND_OPTIONS = [
  { value: "improving", label: "📈 Improving" },
  { value: "stable", label: "➡️ Stable" },
  { value: "declining", label: "📉 Declining" },
] as const;

export const CompetitionCheckinDialog = ({ prepId, weekNumber, onClose, onSubmitted }: Props) => {
  const [avgWeight, setAvgWeight] = useState("");
  const [adherence, setAdherence] = useState("80");
  const [hunger, setHunger] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [recovery, setRecovery] = useState(3);
  const [perfTrend, setPerfTrend] = useState<"improving" | "stable" | "declining">("stable");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!user || !avgWeight) return;
    setSaving(true);

    try {
      const baseline = await getUserBaseline(user.id);
      if (!baseline?.weight || !baseline?.tdee) throw new Error("Missing baseline");

      const weightKg = baseline.unit_system === "imperial"
        ? baseline.weight / 2.205
        : baseline.weight;

      const checkinInput: WeeklyCheckinInput = {
        avgWeight: parseFloat(avgWeight),
        adherencePct: parseInt(adherence) || 80,
        hungerLevel: hunger,
        energyLevel: energy,
        recoveryLevel: recovery,
        performanceTrend: perfTrend,
      };

      const { adjustment } = await submitCheckin(prepId, checkinInput, weekNumber, weightKg, baseline.tdee);

      toast({
        title: "Check-in submitted",
        description: adjustment.reason,
      });
      onSubmitted();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to submit.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const ScaleSelector = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2 mt-1">
        {SCALE_OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-lg border text-sm font-medium transition-all ${
              value === n
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Week {weekNumber} Check-In</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>7-Day Average Weight (kg)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="e.g. 86.5"
              value={avgWeight}
              onChange={(e) => setAvgWeight(e.target.value)}
              className="mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Use your average, not a single weigh-in
            </p>
          </div>

          <div>
            <Label>Adherence %</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={adherence}
              onChange={(e) => setAdherence(e.target.value)}
              className="mt-1"
            />
          </div>

          <ScaleSelector value={hunger} onChange={setHunger} label="Hunger (1=low, 5=very high)" />
          <ScaleSelector value={energy} onChange={setEnergy} label="Energy (1=very low, 5=great)" />
          <ScaleSelector value={recovery} onChange={setRecovery} label="Recovery (1=poor, 5=excellent)" />

          <div>
            <Label className="text-sm">Performance Trend</Label>
            <div className="flex gap-2 mt-1">
              {TREND_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setPerfTrend(t.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${
                    perfTrend === t.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations this week..."
              className="mt-1"
            />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !avgWeight} className="w-full">
            {saving ? "Submitting..." : "Submit Check-In"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
