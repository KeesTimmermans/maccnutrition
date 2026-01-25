import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MeasurementsStep, MeasurementsData } from "@/components/MeasurementsStep";
import { updateUserMeasurements, UserBaseline } from "@/lib/userService";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface MeasurementsSettingsProps {
  baseline: UserBaseline | null;
  onUpdate?: () => void;
}

export const MeasurementsSettings = ({ baseline, onUpdate }: MeasurementsSettingsProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [data, setData] = useState<MeasurementsData>({
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

  const updateData = <K extends keyof MeasurementsData>(key: K, value: MeasurementsData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await updateUserMeasurements({
        body_fat_percentage: data.bodyFatPercentage ? parseFloat(data.bodyFatPercentage) : null,
        waist_cm: data.waist ? parseFloat(data.waist) : null,
        hip_cm: data.hip ? parseFloat(data.hip) : null,
        chest_cm: data.chest ? parseFloat(data.chest) : null,
        arm_cm: data.arm ? parseFloat(data.arm) : null,
        thigh_cm: data.thigh ? parseFloat(data.thigh) : null,
        neck_cm: data.neck ? parseFloat(data.neck) : null,
        progress_photo_url: data.progressPhotoUrl,
      });
      toast.success("Measurements updated successfully!");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating measurements:", error);
      toast.error("Failed to update measurements");
    } finally {
      setIsUpdating(false);
    }
  };

  const unitSystem = baseline?.unit_system === "metric" ? "metric" : "imperial";

  return (
    <div className="space-y-6">
      <MeasurementsStep
        data={data}
        updateData={updateData}
        unitSystem={unitSystem as "imperial" | "metric"}
        t={(key) => key}
        isOnboarding={false}
      />
      
      <Button 
        onClick={handleSave} 
        disabled={isUpdating}
        className="w-full"
      >
        <Save className="w-4 h-4 mr-2" />
        {isUpdating ? "Saving..." : "Save Measurements"}
      </Button>

      {baseline?.measurements_updated_at && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(baseline.measurements_updated_at).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
