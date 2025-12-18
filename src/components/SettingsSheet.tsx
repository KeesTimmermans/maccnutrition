import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, UserBaseline } from "@/lib/userService";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SettingsSheetProps {
  baseline: UserBaseline | null;
  onSettingsChange?: () => void;
}

export const SettingsSheet = ({ baseline, onSettingsChange }: SettingsSheetProps) => {
  const navigate = useNavigate();
  const [isMetric, setIsMetric] = useState(baseline?.unit_system === "metric");
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUnitChange = async (checked: boolean) => {
    setIsMetric(checked);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ unit_system: checked ? "metric" : "imperial" });
      toast.success(`Units switched to ${checked ? "metric" : "imperial"}`);
      onSettingsChange?.();
    } catch (error) {
      console.error("Error updating unit system:", error);
      toast.error("Failed to update settings");
      setIsMetric(!checked); // Revert on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Logged out successfully");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-muted rounded-xl transition-colors">
          <Settings className="w-6 h-6 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Unit System */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Display Units</h3>
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div className="space-y-1">
                <Label htmlFor="unit-toggle" className="text-sm font-medium">
                  Use Metric Units
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isMetric 
                    ? "kg, cm, liters, grams" 
                    : "lbs, ft/in, oz, cups"}
                </p>
              </div>
              <Switch
                id="unit-toggle"
                checked={isMetric}
                onCheckedChange={handleUnitChange}
                disabled={isUpdating}
              />
            </div>
          </div>

          {/* User Info */}
          {baseline && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Your Profile</h3>
              <div className="p-4 bg-muted rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Goal</span>
                  <span className="text-foreground capitalize">
                    {baseline.primary_goal?.replace(/_/g, " ") || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Daily Calories</span>
                  <span className="text-foreground">
                    {baseline.target_calories?.toLocaleString() || "Not set"} kcal
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activity Level</span>
                  <span className="text-foreground capitalize">
                    {baseline.activity_level?.replace(/_/g, " ") || "Not set"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Logout */}
          <div className="pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
