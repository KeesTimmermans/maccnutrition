import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Ruler, 
  Percent, 
  Camera, 
  Info,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ProgressPhotoUpload, ProgressPhotos } from "@/components/ProgressPhotoUpload";

export interface MeasurementsData {
  bodyFatPercentage: string;
  waist: string;
  thigh: string;
  leftArm?: string;
  rightArm?: string;
  clothingSize?: string;
  hasProgressPhoto: boolean;
  progressPhotoUrl: string | null;
  // New multi-photo fields
  progressPhotos: ProgressPhotos;
  /** @deprecated legacy fields still used by Settings/Progress screens */
  hip?: string;
  /** @deprecated */
  chest?: string;
  /** @deprecated */
  arm?: string;
  /** @deprecated */
  neck?: string;
}

interface MeasurementsStepProps {
  data: MeasurementsData;
  updateData: <K extends keyof MeasurementsData>(key: K, value: MeasurementsData[K]) => void;
  unitSystem: "imperial" | "metric";
  t: (key: string) => string;
  isOnboarding?: boolean;
}

export const MeasurementsStep = ({ 
  data, 
  updateData, 
  unitSystem,
  t,
  isOnboarding = true 
}: MeasurementsStepProps) => {
  const [showCircumferenceTips, setShowCircumferenceTips] = useState(false);
  const [showBodyFatTips, setShowBodyFatTips] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(false);

  const unit = unitSystem === "metric" ? "cm" : "in";

  // Ensure progressPhotos exists with defaults
  const currentPhotos: ProgressPhotos = data.progressPhotos || {
    front: data.progressPhotoUrl || null,
    back: null,
    left: null,
    right: null,
  };

  const handlePhotosChange = (photos: ProgressPhotos) => {
    updateData("progressPhotos", photos);
    // Update legacy fields for backwards compatibility
    const hasAnyPhoto = Object.values(photos).some(url => url !== null);
    updateData("hasProgressPhoto", hasAnyPhoto);
    updateData("progressPhotoUrl", photos.front);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {isOnboarding && (
        <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground font-medium">
              These measurements are optional
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              You can skip this step and add them later in Settings. Tracking measurements helps monitor progress beyond the scale.
            </p>
          </div>
        </div>
      )}

      {/* Circumference Measurements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            <Label className="text-sm font-semibold">Circumference Measurements ({unit})</Label>
          </div>
          <Collapsible open={showCircumferenceTips} onOpenChange={setShowCircumferenceTips}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Lightbulb className="w-3.5 h-3.5" />
              Tips
              {showCircumferenceTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        <Collapsible open={showCircumferenceTips} onOpenChange={setShowCircumferenceTips}>
          <CollapsibleContent>
            <div className="bg-muted rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-foreground font-medium">📏 How to measure consistently:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 pl-4">
                <li>• Measure first thing in the morning, before eating</li>
                <li>• Use a flexible tape measure, keeping it snug but not tight</li>
                <li>• Keep the tape level and parallel to the floor</li>
                <li>• Measure the same spot each time</li>
                <li>• Take 3 measurements and use the average</li>
              </ul>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-foreground font-medium mb-1.5">Measurement points:</p>
                <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                  <li>• <strong>Waist:</strong> At the narrowest point, usually just above belly button</li>
                  <li>• <strong>Left / Right arm:</strong> At the largest part of your upper arm, relaxed — measure both for symmetry tracking</li>
                  <li>• <strong>Legs:</strong> At the widest part of your thigh, standing</li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Waist</Label>
            <Input
              type="number"
              placeholder={`e.g. ${unitSystem === "metric" ? "80" : "32"}`}
              value={data.waist}
              onChange={(e) => updateData("waist", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Left Arm (Bicep)</Label>
            <Input
              type="number"
              placeholder={`e.g. ${unitSystem === "metric" ? "35" : "14"}`}
              value={data.leftArm ?? ""}
              onChange={(e) => updateData("leftArm", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Right Arm (Bicep)</Label>
            <Input
              type="number"
              placeholder={`e.g. ${unitSystem === "metric" ? "35" : "14"}`}
              value={data.rightArm ?? ""}
              onChange={(e) => updateData("rightArm", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Legs</Label>
            <Input
              type="number"
              placeholder={`e.g. ${unitSystem === "metric" ? "55" : "22"}`}
              value={data.thigh}
              onChange={(e) => updateData("thigh", e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Clothing size (optional)</Label>
          <Input
            type="text"
            placeholder="e.g. M, or UK 12"
            value={data.clothingSize ?? ""}
            onChange={(e) => updateData("clothingSize", e.target.value)}
            className="h-11 rounded-xl"
          />
        </div>
      </div>


      {/* Body Fat Percentage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-secondary" />
            <Label className="text-sm font-semibold">Body Fat %</Label>
          </div>
          <Collapsible open={showBodyFatTips} onOpenChange={setShowBodyFatTips}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Lightbulb className="w-3.5 h-3.5" />
              Tips
              {showBodyFatTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        <Collapsible open={showBodyFatTips} onOpenChange={setShowBodyFatTips}>
          <CollapsibleContent>
            <div className="bg-muted rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-foreground font-medium">📊 Methods to estimate body fat:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 pl-4">
                <li>• <strong>Smart scale:</strong> Convenient but can vary with hydration (±3-5%)</li>
                <li>• <strong>Skinfold calipers:</strong> More accurate when done consistently</li>
                <li>• <strong>DEXA scan:</strong> Gold standard, very accurate (usually at clinics)</li>
                <li>• <strong>Visual comparison:</strong> Compare to reference photos (rough estimate)</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                💡 Tip: Track changes over time rather than focusing on exact numbers. Measure under the same conditions each time.
              </p>
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-foreground font-medium mb-1.5">Reference ranges:</p>
                <ul className="text-xs text-muted-foreground space-y-1 pl-4">
                  <li>• <strong>Men:</strong> 10-20% (athletic: 6-13%)</li>
                  <li>• <strong>Women:</strong> 18-28% (athletic: 14-20%)</li>
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Input
          type="number"
          placeholder="e.g. 18"
          value={data.bodyFatPercentage}
          onChange={(e) => updateData("bodyFatPercentage", e.target.value)}
          className="h-11 rounded-xl"
          step="0.1"
        />
      </div>

      {/* Progress Photos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-accent" />
            <Label className="text-sm font-semibold">Progress Photos</Label>
          </div>
          <Collapsible open={showPhotoTips} onOpenChange={setShowPhotoTips}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Lightbulb className="w-3.5 h-3.5" />
              Tips
              {showPhotoTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        <Collapsible open={showPhotoTips} onOpenChange={setShowPhotoTips}>
          <CollapsibleContent>
            <div className="bg-muted rounded-xl p-4 mb-4 space-y-2">
              <p className="text-xs text-foreground font-medium">📸 How to take consistent progress photos:</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 pl-4">
                <li>• <strong>Same time:</strong> First thing in the morning, before eating</li>
                <li>• <strong>Same lighting:</strong> Natural light works best, avoid direct overhead</li>
                <li>• <strong>Same location:</strong> Use the same spot with a plain background</li>
                <li>• <strong>All 4 angles:</strong> Front, back, and both side views</li>
                <li>• <strong>Same distance:</strong> Mark a spot on the floor or use a tripod</li>
                <li>• <strong>Minimal clothing:</strong> Swimwear or fitted clothes for visibility</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                💡 Tip: Take photos every 2-4 weeks. Daily changes are hard to see, but monthly comparisons reveal progress!
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ProgressPhotoUpload
          photos={currentPhotos}
          onPhotosChange={handlePhotosChange}
          disabled={false}
        />
      </div>
    </div>
  );
};
