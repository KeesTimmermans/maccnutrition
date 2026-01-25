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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeasurementsStep, MeasurementsData } from "@/components/MeasurementsStep";
import { updateUserMeasurements, UserBaseline } from "@/lib/userService";
import { applyProgressBoost } from "@/lib/baselineRecalibration";
import { saveProgressUpdate, parseFocusPoints, CoachingFocusPoint } from "@/lib/progressUpdateService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, ThumbsUp, Target, Ruler, ChevronRight, ChevronLeft, Sparkles, Loader2, MessageCircle } from "lucide-react";

interface ProgressUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseline: UserBaseline | null;
  onComplete?: () => void;
}

type ProgressChoice = "happy" | "more_progress" | "update_measurements";
type DialogStep = "choice" | "measurements" | "feedback" | "response";

export const ProgressUpdateDialog = ({
  open,
  onOpenChange,
  baseline,
  onComplete,
}: ProgressUpdateDialogProps) => {
  const [step, setStep] = useState<DialogStep>("choice");
  const [choice, setChoice] = useState<ProgressChoice | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const [recalibrationInfo, setRecalibrationInfo] = useState<{
    calorieChange: number;
    proteinChange: number;
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

  const unitSystem = baseline?.unit_system === "metric" ? "metric" : "imperial";

  const updateMeasurementsData = <K extends keyof MeasurementsData>(
    key: K,
    value: MeasurementsData[K]
  ) => {
    setMeasurementsData((prev) => ({ ...prev, [key]: value }));
  };

  const handleChoiceSelect = (value: ProgressChoice) => {
    setChoice(value);
  };

  const handleNext = () => {
    if (choice === "update_measurements") {
      setStep("measurements");
    } else {
      setStep("feedback");
    }
  };

  const handleBack = () => {
    if (step === "feedback" || step === "measurements") {
      setStep("choice");
    } else if (step === "response") {
      setStep("choice");
    }
  };

  const markProgressUpdateComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_baselines")
      .update({ last_progress_update: new Date().toISOString() })
      .eq("user_id", user.id);
  };

  const callAICoach = async (userChoice: ProgressChoice, userFeedback: string, measurementsUpdated: boolean) => {
    if (!baseline) return null;

    const choiceMessages: Record<ProgressChoice, string> = {
      happy: "I just completed my monthly progress check-in. I'm feeling happy with my current progress and want to keep going with the current plan!",
      more_progress: `I just completed my monthly progress check-in. I want to push harder and progress more! ${userFeedback ? `Here's what I'm thinking: ${userFeedback}` : ''}`,
      update_measurements: `I just completed my monthly progress check-in and updated my body measurements. ${userFeedback ? `Additional notes: ${userFeedback}` : ''}`,
    };

    try {
      const { data, error } = await supabase.functions.invoke("ai-coach", {
        body: {
          message: choiceMessages[userChoice],
          type: "progress_update",
          progressUpdateData: {
            choice: userChoice,
            feedback: userFeedback || undefined,
            measurementsUpdated,
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

      if (error) {
        console.error("Error calling AI coach:", error);
        return null;
      }

      return data?.response || null;
    } catch (err) {
      console.error("Error invoking AI coach:", err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!choice || !baseline) return;
    
    setIsSubmitting(true);
    try {
      let measurementsUpdated = false;
      let currentMeasurements: {
        weight?: number | null;
        bodyFatPercentage?: number | null;
        waistCm?: number | null;
        hipCm?: number | null;
        chestCm?: number | null;
        armCm?: number | null;
        thighCm?: number | null;
        neckCm?: number | null;
      } = {};

      // If updating measurements, save them first
      if (choice === "update_measurements") {
        currentMeasurements = {
          bodyFatPercentage: measurementsData.bodyFatPercentage
            ? parseFloat(measurementsData.bodyFatPercentage)
            : null,
          waistCm: measurementsData.waist ? parseFloat(measurementsData.waist) : null,
          hipCm: measurementsData.hip ? parseFloat(measurementsData.hip) : null,
          chestCm: measurementsData.chest ? parseFloat(measurementsData.chest) : null,
          armCm: measurementsData.arm ? parseFloat(measurementsData.arm) : null,
          thighCm: measurementsData.thigh ? parseFloat(measurementsData.thigh) : null,
          neckCm: measurementsData.neck ? parseFloat(measurementsData.neck) : null,
        };

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
        measurementsUpdated = true;
        toast.success("Measurements updated successfully!");
      }

      // If user wants more progress, apply baseline recalibration
      let adjustmentsInfo: { calorieChange: number; proteinChange: number; reason: string } | undefined;
      if (choice === "more_progress") {
        const boostResult = await applyProgressBoost(baseline);
        if (boostResult.success && boostResult.adjustments) {
          setRecalibrationInfo(boostResult.adjustments);
          adjustmentsInfo = boostResult.adjustments;
          toast.success("Your targets have been adjusted to push you further! 💪");
        }
      }

      // Call AI Coach for personalized response
      const rawResponse = await callAICoach(choice, feedback, measurementsUpdated);
      
      // Parse focus points from the response
      let cleanResponse: string | null = null;
      let focusPoints: CoachingFocusPoint[] = [];
      
      if (rawResponse) {
        const parsed = parseFocusPoints(rawResponse);
        cleanResponse = parsed.cleanResponse;
        focusPoints = parsed.focusPoints;
      }
      
      // Save progress update to database (including focus points)
      try {
        await saveProgressUpdate({
          satisfactionChoice: choice,
          userFeedback: feedback || undefined,
          coachResponse: cleanResponse || undefined,
          coachingFocusPoints: focusPoints.length > 0 ? focusPoints : undefined,
          adjustments: adjustmentsInfo,
          baseline,
          measurements: choice === "update_measurements" ? currentMeasurements : undefined,
        });
      } catch (saveError) {
        console.error("Error saving progress update history:", saveError);
        // Don't fail the whole flow if history save fails
      }
      
      if (cleanResponse) {
        setCoachResponse(cleanResponse);
        setStep("response");
      } else {
        // Fallback if AI fails
        if (choice === "happy") {
          toast.success("Great to hear you're happy with your progress! Keep it up! 🎉");
        } else if (choice === "more_progress") {
          toast.success("Your plan has been intensified. Let's push harder! 💪");
        }
        await markProgressUpdateComplete();
        onComplete?.();
        onOpenChange(false);
        resetDialog();
      }

      // Mark progress update as complete
      await markProgressUpdateComplete();

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
    setStep("choice");
    setChoice(null);
    setFeedback("");
    setCoachResponse(null);
    setRecalibrationInfo(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetDialog();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Monthly Progress Check-in
          </DialogTitle>
          <DialogDescription>
            {step === "choice" && "It's time for your monthly check-in! How are you feeling about your progress?"}
            {step === "measurements" && "Update your body measurements to track your progress."}
            {step === "feedback" && "Any additional thoughts to share with Coach Mac?"}
            {step === "response" && "Here's what Coach Mac has to say!"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "choice" && (
            <div className="space-y-4">
              <RadioGroup
                value={choice || ""}
                onValueChange={(value) => handleChoiceSelect(value as ProgressChoice)}
                className="space-y-3"
              >
                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    choice === "happy"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleChoiceSelect("happy")}
                >
                  <RadioGroupItem value="happy" id="happy" />
                  <Label
                    htmlFor="happy"
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <ThumbsUp className="w-5 h-5 text-accent" />
                    <div>
                      <p className="font-medium">I'm happy with my progress!</p>
                      <p className="text-sm text-muted-foreground">
                        Keep the current plan going
                      </p>
                    </div>
                  </Label>
                </div>

                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    choice === "more_progress"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleChoiceSelect("more_progress")}
                >
                  <RadioGroupItem value="more_progress" id="more_progress" />
                  <Label
                    htmlFor="more_progress"
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <Target className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">I want to progress more</p>
                      <p className="text-sm text-muted-foreground">
                        Adjust my plan to push harder
                      </p>
                    </div>
                  </Label>
                </div>

                <div
                  className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    choice === "update_measurements"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleChoiceSelect("update_measurements")}
                >
                  <RadioGroupItem value="update_measurements" id="update_measurements" />
                  <Label
                    htmlFor="update_measurements"
                    className="flex-1 cursor-pointer flex items-center gap-3"
                  >
                    <Ruler className="w-5 h-5 text-secondary" />
                    <div>
                      <p className="font-medium">Update my measurements</p>
                      <p className="text-sm text-muted-foreground">
                        Record new body stats & progress photo
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <Button
                onClick={handleNext}
                disabled={!choice}
                className="w-full mt-4"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

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
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save & Get Feedback
                      <TrendingUp className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "feedback" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-1">Your choice:</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {choice === "happy" && (
                    <>
                      <ThumbsUp className="w-4 h-4 text-accent" />
                      Happy with current progress
                    </>
                  )}
                  {choice === "more_progress" && (
                    <>
                      <Target className="w-4 h-4 text-primary" />
                      Want to progress more
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">
                  Additional notes for Coach Mac (optional)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Any specific areas you'd like to focus on, challenges you're facing, or wins you want to share..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Getting response...
                    </>
                  ) : (
                    <>
                      Complete Check-in
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "response" && (
            <div className="space-y-4">
              {/* Recalibration info badge */}
              {recalibrationInfo && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Targets Adjusted</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {recalibrationInfo.reason}
                    {recalibrationInfo.calorieChange !== 0 && (
                      <span className="block mt-1">
                        Calories: {recalibrationInfo.calorieChange > 0 ? '+' : ''}{recalibrationInfo.calorieChange} kcal
                      </span>
                    )}
                    {recalibrationInfo.proteinChange !== 0 && (
                      <span className="block">
                        Protein: {recalibrationInfo.proteinChange > 0 ? '+' : ''}{recalibrationInfo.proteinChange}g
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Coach response */}
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Coach Mac</span>
                </div>
                <ScrollArea className="max-h-[300px]">
                  <div className="prose prose-sm max-w-none text-foreground">
                    {coachResponse?.split('\n').map((paragraph, i) => (
                      <p key={i} className="mb-2 last:mb-0 text-sm leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button onClick={handleFinish} className="w-full">
                Done
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
