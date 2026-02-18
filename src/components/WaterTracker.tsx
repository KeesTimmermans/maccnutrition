import { useState, useEffect } from "react";
import { Droplets, Plus, Minus, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getTodaysWaterIntake, addWaterIntake, removeLastWaterIntake, WaterIntake } from "@/lib/waterService";
import { trackWaterLogged } from "@/lib/analytics";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface WaterTrackerProps {
  dailyGoalLiters: number;
  onWaterLogged?: () => void;
}

const GLASS_SIZES = [
  { label: "Small", ml: 200, icon: "🥛" },
  { label: "Medium", ml: 350, icon: "🥤" },
  { label: "Large", ml: 500, icon: "🍶" },
];

export const WaterTracker = ({ dailyGoalLiters, onWaterLogged }: WaterTrackerProps) => {
  const { t } = useLanguage();
  const [intakes, setIntakes] = useState<WaterIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const dailyGoalMl = dailyGoalLiters * 1000;
  const totalMl = intakes.reduce((sum, i) => sum + i.amount_ml, 0);
  const progress = Math.min((totalMl / dailyGoalMl) * 100, 100);
  const remaining = Math.max(dailyGoalMl - totalMl, 0);

  useEffect(() => {
    loadWaterIntake();
  }, []);

  useEffect(() => {
    // Check for reminder permission and set up interval
    if (reminderEnabled && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }

      const interval = setInterval(() => {
        if (Notification.permission === "granted" && totalMl < dailyGoalMl) {
          new Notification("💧 Water Reminder", {
            body: `You've had ${(totalMl / 1000).toFixed(1)}L today. ${(remaining / 1000).toFixed(1)}L to go!`,
            icon: "/favicon.ico",
          });
        }
      }, 60 * 60 * 1000); // Every hour

      return () => clearInterval(interval);
    }
  }, [reminderEnabled, totalMl, dailyGoalMl, remaining]);

  const loadWaterIntake = async () => {
    try {
      const data = await getTodaysWaterIntake();
      setIntakes(data);
    } catch (error) {
      console.error("Error loading water intake:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWater = async (amountMl: number) => {
    // Pass current totals so the service can determine if goal was reached
    const newIntake = await addWaterIntake(amountMl, {
      currentTotalMl: totalMl,
      dailyGoalMl: dailyGoalMl,
    });
    if (newIntake) {
      setIntakes(prev => [...prev, newIntake]);
      trackWaterLogged();
      // Notify parent to refresh coaching points
      onWaterLogged?.();
    }
  };

  const handleRemoveWater = async () => {
    if (intakes.length === 0) return;
    
    const success = await removeLastWaterIntake();
    if (success) {
      setIntakes(prev => prev.slice(0, -1));
      toast.success(t('removed_last_entry'));
    }
  };

  const toggleReminder = () => {
    if (!reminderEnabled && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            setReminderEnabled(true);
            toast.success(t('water_reminders_enabled'));
          }
        });
      } else if (Notification.permission === "granted") {
        setReminderEnabled(true);
        toast.success(t('water_reminders_enabled'));
      } else {
        toast.error(t('enable_notifications'));
      }
    } else {
      setReminderEnabled(!reminderEnabled);
      toast.success(reminderEnabled ? t('reminders_disabled') : t('reminders_enabled'));
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium">
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('loading_water_tracker')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-foreground">{t('water_intake')}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleReminder}
            className={`p-2 ${reminderEnabled ? 'text-blue-500' : 'text-muted-foreground'}`}
          >
            <Bell className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress visualization */}
        <div className="relative mb-4">
          <div className="flex items-end justify-center gap-1 mb-2">
            <span className="text-4xl font-bold text-foreground">
              {(totalMl / 1000).toFixed(1)}
            </span>
            <span className="text-lg text-muted-foreground mb-1">
              / {dailyGoalLiters.toFixed(1)}L
            </span>
          </div>
          <Progress value={progress} className="h-3 bg-blue-100" />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {remaining > 0 ? `${(remaining / 1000).toFixed(1)}L ${t('remaining')}` : `${t('goal_reached')} 🎉`}
          </p>
        </div>

        {/* Water drops visualization */}
        <div className="flex justify-center gap-1 mb-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-6 rounded-full transition-all ${
                i < Math.floor((totalMl / dailyGoalMl) * 8)
                  ? 'bg-blue-500'
                  : 'bg-blue-100'
              }`}
            />
          ))}
        </div>

        {/* Quick add buttons */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {GLASS_SIZES.map(size => (
            <Button
              key={size.ml}
              variant="outline"
              onClick={() => handleAddWater(size.ml)}
              className="flex flex-col items-center py-3 h-auto hover:bg-blue-50 hover:border-blue-300"
            >
              <span className="text-lg">{size.icon}</span>
              <span className="text-xs font-medium">{size.ml}ml</span>
            </Button>
          ))}
        </div>

        {/* Undo button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemoveWater}
          disabled={intakes.length === 0}
          className="w-full text-muted-foreground"
        >
          <Minus className="w-4 h-4 mr-1" />
          {t('undo_last')}
        </Button>
      </CardContent>
    </Card>
  );
};