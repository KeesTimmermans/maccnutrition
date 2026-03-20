import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeasurementsStep, MeasurementsData } from "@/components/MeasurementsStep";
import { updateUserMeasurements, UserBaseline } from "@/lib/userService";
import {
  applyProgressAdjustment,
  persistProgressAdjustment,
  CheckinInputs,
  ProgressStatus,
  EnergyLevel,
  HungerLevel,
  ActionIntent,
} from "@/lib/progressAdjustment";
import { parseFocusPoints, CoachingFocusPoint } from "@/lib/progressUpdateService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveNutritionTargets } from "@/hooks/useActiveNutritionTargets";
import {
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  MessageCircle,
  Gauge,
  Zap,
  UtensilsCrossed,
  Target,
} from "lucide-react";

interface ProgressUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseline: UserBaseline | null;
  onComplete?: () => void;
}

type DialogStep = "status" | "biofeedback" | "action" | "measurements" | "feedback" | "response";

const STATUS_OPTIONS: { value: ProgressStatus; label: string; desc: string }[] = [
  { value: "on_track", label: "On track", desc: "Things are going as expected" },
  { value: "slower_than_expected", label: "Slower than expected", desc: "Progress has stalled or slowed" },
  { value: "faster_than_expected", label: "Faster than expected", desc: "Progressing quicker than planned" },
  { value: "no_change", label: "No change", desc: "Nothing noticeable yet" },
];

const ACTION_OPTIONS: { value: ActionIntent; label: string; desc: string }[] = [
  { value: "keep_plan", label: "Keep current plan", desc: "Stay the course" },
  { value: "increase_rate", label: "Push harder", desc: "Intensify to speed up results" },
  { value: "reduce_fatigue", label: "Reduce fatigue", desc: "Ease off slightly for recovery" },
  { value: "diet_break", label: "Diet break", desc: "Temporarily return to maintenance calories" },
];

export const ProgressUpdateDialog = ({
  open,
  onOpenChange,
  baseline,
  onComplete,
}: ProgressUpdateDialogProps) => {
  const [step, setStep] = useState<DialogStep>("status");
  const [progressStatus, setProgressStatus] = useState<ProgressStatus | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [hunger, setHunger] = useState<HungerLevel | null>(null);
  const [actionIntent, setActionIntent] = useState<ActionIntent | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [adjustmentResult, setAdjustmentResult] = useState<{
    deltaCalories: number;
    reason: string;
  } | null>(null);
  const [measurementsData, setMeasurementsData] = useState<MeasurementsData>({
    bodyFatPercentage: baseline?.body_fat_percentage?.toString() || "",
    waist: baseline?.waist_cm?.toString() || "",
    hip: baseline?.hip_cm?.toString() || "",
    chest: baseline?.chest_cm?.toString() || "",
    arm: baseline?.arm_cm?.toString() || "",
    thigh: baseline?.thigh_cm?.toString() || "",
    neck: baseline?.neck_cm?.toString() || "",
    hasProgressPhoto: !!baseline?.progress_photo_url || !!baseline?.progress_photo_front,
    progressPhotoUrl: baseline?.progress_photo_url || null,
    progressPhotos: {
      front: baseline?.progress_photo_front || baseline?.progress_photo_url || null,
      back: baseline?.progress_photo_back || null,
      left: baseline?.progress_photo_left || null,
      right: baseline?.progress_photo_right || null,
    },
  });

  const unitSystem = baseline?.unit_system === "imperial" ? "imperial" : "metric";

  const updateMeasurementsData = <K extends keyof MeasurementsData>(
    key: K,
    value: MeasurementsData[K]
  ) => {
    setMeasurementsData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Navigation ────────────────────────────────────────────
  const handleNext = () => {
    if (step === "status") setStep("biofeedback");
    else if (step === "biofeedback") setStep("action");
    else if (step === "action") setStep("measurements");
    else if (step === "measurements") setStep("feedback");
  };

  const handleBack = () => {
    if (step === "biofeedback") setStep("status");
    else if (step === "action") setStep("biofeedback");
    else if (step === "measurements") setStep("action");
    else if (step === "feedback") setStep("measurements");
    else if (step === "response") setStep("status");
  };

  const canProceed = () => {
    if (step === "status") return !!progressStatus;
    if (step === "biofeedback") return !!energy && !!hunger;
    if (step === "action") return !!actionIntent;
    return true;
  };

  // ── AI coach call ─────────────────────────────────────────
  const callAICoach = async (inputs: CheckinInputs) => {
    if (!baseline) return null;
    const msg = `Bi-weekly progress check-in. Status: ${inputs.progressStatus}. Energy: ${inputs.energy}. Hunger: ${inputs.hunger}. Intent: ${inputs.actionIntent}. ${inputs.feedback ? `Notes: ${inputs.feedback}` : ""}`;
    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          message: msg,
          type: "progress_update",
          progressUpdateData: {
            progressStatus: inputs.progressStatus,
            energy: inputs.energy,
            hunger: inputs.hunger,
            actionIntent: inputs.actionIntent,
            feedback: inputs.feedback,
          },
          userContext: {
            userName: baseline.name,
            primaryGoal: baseline.primary_goal,
            secondaryGoals: baseline.secondary_goals,
            targetCalories: baseline.target_calories,
            proteinGrams: baseline.protein_grams,
            carbsGrams: baseline.carbs_grams,
            fatsGrams: baseline.fats_grams,
            activityLevel: baseline.activity_level,
            coachingTone: baseline.coaching_tone,
            focusPoints: baseline.focus_points,
            preferredLanguage: baseline.preferred_language,
          },
        },
      });
      if (error) { console.error("AI coach error:", error); return null; }
      return data?.response || null;
    } catch (err) { console.error("AI coach error:", err); return null; }
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!progressStatus || !energy || !hunger || !actionIntent || !baseline) return;
    setIsSubmitting(true);

    try {
      const inputs: CheckinInputs = { progressStatus, energy, hunger, actionIntent, feedback: feedback || undefined };

      // Save measurements if changed
      const currentMeasurements: Record<string, number | null> = {
        bodyFatPercentage: measurementsData.bodyFatPercentage ? parseFloat(measurementsData.bodyFatPercentage) : null,
        waistCm: measurementsData.waist ? parseFloat(measurementsData.waist) : null,
        hipCm: measurementsData.hip ? parseFloat(measurementsData.hip) : null,
        chestCm: measurementsData.chest ? parseFloat(measurementsData.chest) : null,
        armCm: measurementsData.arm ? parseFloat(measurementsData.arm) : null,
        thighCm: measurementsData.thigh ? parseFloat(measurementsData.thigh) : null,
        neckCm: measurementsData.neck ? parseFloat(measurementsData.neck) : null,
      };

      const hasNewMeasurements = Object.values(currentMeasurements).some((v) => v !== null);
      if (hasNewMeasurements) {
        await updateUserMeasurements({
          body_fat_percentage: currentMeasurements.bodyFatPercentage,
          waist_cm: currentMeasurements.waistCm,
          hip_cm: currentMeasurements.hipCm,
          chest_cm: currentMeasurements.chestCm,
          arm_cm: currentMeasurements.armCm,
          thigh_cm: currentMeasurements.thighCm,
          neck_cm: currentMeasurements.neckCm,
          progress_photo_url: measurementsData.progressPhotoUrl,
        });
      }

      // Apply coaching adjustment
      const adjustment = applyProgressAdjustment(
        {
          calories: baseline.target_calories || 2000,
          protein: baseline.protein_grams || 150,
          carbs: baseline.carbs_grams || 200,
          fats: baseline.fats_grams || 70,
        },
        {
          primaryGoal: baseline.primary_goal,
          sex: baseline.sex,
          weight: baseline.weight,
          tdee: baseline.tdee,
        },
        inputs
      );
      setAdjustmentResult({ deltaCalories: adjustment.deltaCalories, reason: adjustment.reason });

      // AI coach response
      const rawResponse = await callAICoach(inputs);
      let cleanResponse: string | null = null;
      let focusPoints: CoachingFocusPoint[] = [];
      if (rawResponse) {
        const parsed = parseFocusPoints(rawResponse);
        cleanResponse = parsed.cleanResponse;
        focusPoints = parsed.focusPoints;
      }

      // Persist everything
      await persistProgressAdjustment(
        adjustment,
        inputs,
        cleanResponse,
        focusPoints.length > 0 ? focusPoints : null,
        baseline,
        hasNewMeasurements ? currentMeasurements : undefined
      );

      if (adjustment.deltaCalories !== 0) {
        toast.success(`Targets adjusted: ${adjustment.deltaCalories > 0 ? "+" : ""}${adjustment.deltaCalories} kcal`);
      }

      if (cleanResponse) {
        setCoachResponse(cleanResponse);
        setStep("response");
      } else {
        toast.success("Check-in complete! 🎉");
        onComplete?.();
        onOpenChange(false);
        resetDialog();
      }
    } catch (error) {
      console.error("Error submitting progress update:", error);
      toast.error("Failed to save progress update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onComplete?.();
    onOpenChange(false);
    resetDialog();
  };

  const resetDialog = () => {
    setStep("status");
    setProgressStatus(null);
    setEnergy(null);
    setHunger(null);
    setActionIntent(null);
    setFeedback("");
    setCoachResponse(null);
    setAdjustmentResult(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetDialog();
    onOpenChange(newOpen);
  };

  // ── Selector card helper ──────────────────────────────────
  const OptionCard = ({
    selected,
    onClick,
    label,
    desc,
  }: {
    selected: boolean;
    onClick: () => void;
    label: string;
    desc: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <p className="font-medium text-sm">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );

  const ToggleChip = ({
    selected,
    onClick,
    label,
  }: {
    selected: boolean;
    onClick: () => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
        selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
      }`}
    >
      {label}
    </button>
  );

  // ── Step labels ───────────────────────────────────────────
  const stepNumber = { status: 1, biofeedback: 2, action: 3, measurements: 4, feedback: 5, response: 6 };
  const totalSteps = 5;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Bi-Weekly Progress Check-in
          </DialogTitle>
          <DialogDescription>
            {step === "status" && "How has your progress been over the last 2 weeks?"}
            {step === "biofeedback" && "How are your energy and hunger levels?"}
            {step === "action" && "What would you like to do next?"}
            {step === "measurements" && "Update your body measurements (optional)."}
            {step === "feedback" && "Any additional notes for Coach Mac?"}
            {step === "response" && "Here's what Coach Mac recommends!"}
          </DialogDescription>
          {step !== "response" && (
            <div className="flex gap-1 mt-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${
                    i < stepNumber[step] ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="py-4">
          {/* ── Step 1: Progress Status ─────────────────────── */}
          {step === "status" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-primary" />
                <Label className="font-medium">Progress Status</Label>
              </div>
              {STATUS_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  selected={progressStatus === opt.value}
                  onClick={() => setProgressStatus(opt.value)}
                  label={opt.label}
                  desc={opt.desc}
                />
              ))}
              <Button onClick={handleNext} disabled={!canProceed()} className="w-full mt-4">
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Biofeedback ────────────────────────── */}
          {step === "biofeedback" && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Energy Level</Label>
                </div>
                <div className="flex gap-3">
                  <ToggleChip selected={energy === "good"} onClick={() => setEnergy("good")} label="Good" />
                  <ToggleChip selected={energy === "low"} onClick={() => setEnergy("low")} label="Low" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed className="w-4 h-4 text-primary" />
                  <Label className="font-medium">Hunger Level</Label>
                </div>
                <div className="flex gap-3">
                  <ToggleChip selected={hunger === "manageable"} onClick={() => setHunger("manageable")} label="Manageable" />
                  <ToggleChip selected={hunger === "high"} onClick={() => setHunger("high")} label="High" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceed()} className="flex-1">
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Action Intent ──────────────────────── */}
          {step === "action" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <Label className="font-medium">What would you like to do?</Label>
              </div>
              {ACTION_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.value}
                  selected={actionIntent === opt.value}
                  onClick={() => setActionIntent(opt.value)}
                  label={opt.label}
                  desc={opt.desc}
                />
              ))}
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceed()} className="flex-1">
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Measurements (optional) ────────────── */}
          {step === "measurements" && (
            <div className="space-y-4">
              <MeasurementsStep
                data={measurementsData}
                updateData={updateMeasurementsData}
                unitSystem={unitSystem as "imperial" | "metric"}
                t={(key) => key}
                isOnboarding={false}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleNext} className="flex-1">
                  Continue <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Free-text Feedback ─────────────────── */}
          {step === "feedback" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feedback">Additional notes for Coach Mac (optional)</Label>
                <Textarea
                  id="feedback"
                  placeholder="Anything you'd like to share — challenges, wins, how you're feeling..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <>Complete Check-in <Sparkles className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 6: Coach Response ─────────────────────── */}
          {step === "response" && (
            <div className="space-y-4">
              {adjustmentResult && adjustmentResult.deltaCalories !== 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Targets Adjusted</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {adjustmentResult.reason}
                    <span className="block mt-1">
                      Calories: {adjustmentResult.deltaCalories > 0 ? "+" : ""}{adjustmentResult.deltaCalories} kcal
                    </span>
                  </p>
                </div>
              )}

              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Coach Mac</span>
                </div>
                <ScrollArea className="max-h-[300px]">
                  <div className="prose prose-sm max-w-none text-foreground">
                    {coachResponse?.split("\n").map((paragraph, i) => (
                      <p key={i} className="mb-2 last:mb-0 text-sm leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button onClick={handleFinish} className="w-full">
                Done <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
