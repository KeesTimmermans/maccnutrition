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
import { MeasurementsStep, MeasurementsData } from "@/components/MeasurementsStep";
import { updateUserMeasurements, UserBaseline } from "@/lib/userService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, ThumbsUp, Target, Ruler, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface ProgressUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseline: UserBaseline | null;
  onComplete?: () => void;
}

type ProgressChoice = "happy" | "more_progress" | "update_measurements";

export const ProgressUpdateDialog = ({
  open,
  onOpenChange,
  baseline,
  onComplete,
}: ProgressUpdateDialogProps) => {
  const [step, setStep] = useState<"choice" | "measurements" | "feedback">("choice");
  const [choice, setChoice] = useState<ProgressChoice | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [measurementsData, setMeasurementsData] = useState<MeasurementsData>({
    bodyFatPercentage: baseline?.body_fat_percentage?.toString() || "",
    waist: baseline?.waist_cm?.toString() || "",
    hip: baseline?.hip_cm?.toString() || "",
    chest: baseline?.chest_cm?.toString() || "",
    arm: baseline?.arm_cm?.toString() || "",
    thigh: baseline?.thigh_cm?.toString() || "",
    neck: baseline?.neck_cm?.toString() || "",
    hasProgressPhoto: !!baseline?.progress_photo_url,
    progressPhotoUrl: baseline?.progress_photo_url || null,
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // If updating measurements, save them
      if (choice === "update_measurements") {
        await updateUserMeasurements({
          body_fat_percentage: measurementsData.bodyFatPercentage
            ? parseFloat(measurementsData.bodyFatPercentage)
            : null,
          waist_cm: measurementsData.waist ? parseFloat(measurementsData.waist) : null,
          hip_cm: measurementsData.hip ? parseFloat(measurementsData.hip) : null,
          chest_cm: measurementsData.chest ? parseFloat(measurementsData.chest) : null,
          arm_cm: measurementsData.arm ? parseFloat(measurementsData.arm) : null,
          thigh_cm: measurementsData.thigh ? parseFloat(measurementsData.thigh) : null,
          neck_cm: measurementsData.neck ? parseFloat(measurementsData.neck) : null,
          progress_photo_url: measurementsData.progressPhotoUrl,
        });
        toast.success("Measurements updated successfully!");
      } else if (choice === "happy") {
        toast.success("Great to hear you're happy with your progress! Keep it up! 🎉");
      } else if (choice === "more_progress") {
        toast.success("Noted! Coach Mac will adjust recommendations to help you progress further.");
      }

      // Mark progress update as complete
      await markProgressUpdateComplete();

      onComplete?.();
      onOpenChange(false);
      resetDialog();
    } catch (error) {
      console.error("Error submitting progress update:", error);
      toast.error("Failed to save progress update");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDialog = () => {
    setStep("choice");
    setChoice(null);
    setFeedback("");
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
                  {isSubmitting ? "Saving..." : "Save & Complete"}
                  <TrendingUp className="w-4 h-4 ml-2" />
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
                  {isSubmitting ? "Saving..." : "Complete Check-in"}
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
