import { useState, useEffect } from "react";
import { Bell, Clock, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ReminderPreferences {
  reminders_enabled: boolean;
  reminder_meal_logging: boolean;
  reminder_water_logging: boolean;
  reminder_weekly_summary: boolean;
  reminder_frequency: string;
  reminder_time: string;
  reminder_timezone: string;
}

const FREQUENCIES = [
  { value: "smart", label: "When targets missed" },
  { value: "daily", label: "Once a day" },
  { value: "twice_daily", label: "2x per day" },
  { value: "three_daily", label: "3x per day" },
  { value: "four_daily", label: "4x per day" },
  { value: "weekly", label: "Once a week" },
];

const TIMES = [
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
  { value: "20:00", label: "8:00 PM" },
];

export const ReminderSettings = () => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    reminders_enabled: false,
    reminder_meal_logging: true,
    reminder_water_logging: true,
    reminder_weekly_summary: true,
    reminder_frequency: "daily",
    reminder_time: "09:00",
    reminder_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_baselines")
        .select("reminders_enabled, reminder_meal_logging, reminder_water_logging, reminder_weekly_summary, reminder_frequency, reminder_time, reminder_timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          reminders_enabled: data.reminders_enabled ?? false,
          reminder_meal_logging: data.reminder_meal_logging ?? true,
          reminder_water_logging: data.reminder_water_logging ?? true,
          reminder_weekly_summary: data.reminder_weekly_summary ?? true,
          reminder_frequency: data.reminder_frequency ?? "daily",
          reminder_time: data.reminder_time ?? "09:00",
          reminder_timezone: data.reminder_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
    } catch (error) {
      console.error("Error loading reminder preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof ReminderPreferences, value: boolean | string) => {
    setIsSaving(true);
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_baselines")
        .update({ 
          [key]: value,
          reminder_timezone: newPreferences.reminder_timezone,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(t('settings_saved') || "Settings saved");
    } catch (error) {
      console.error("Error saving reminder preference:", error);
      toast.error(t('error_saving') || "Failed to save");
      setPreferences(preferences);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card rounded-3xl shadow-medium">
        <CardContent className="p-4">
          <div className="animate-pulse h-20 bg-muted rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          {t('reminders') || "Reminders"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="reminders-enabled" className="text-sm">
              {t('email_reminders') || "Email Reminders"}
            </Label>
          </div>
          <Switch
            id="reminders-enabled"
            checked={preferences.reminders_enabled}
            onCheckedChange={(checked) => updatePreference("reminders_enabled", checked)}
            disabled={isSaving}
          />
        </div>

        {preferences.reminders_enabled && (
          <div className="border-t border-border pt-4 space-y-4">
            {/* Global Frequency & Time */}
            <div className="space-y-3 pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">
                    {t('how_often') || "How often"}
                  </Label>
                </div>
                <Select
                  value={preferences.reminder_frequency}
                  onValueChange={(value) => updatePreference("reminder_frequency", value)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-muted-foreground">
                  {t('preferred_time') || "Preferred time"}
                </Label>
                <Select
                  value={preferences.reminder_time}
                  onValueChange={(value) => updatePreference("reminder_time", value)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMES.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reminder Types */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                {t('reminder_types') || "Reminder Types"}
              </Label>
              <div className="flex items-center justify-between">
                <Label htmlFor="meal-reminder" className="text-sm">
                  🍽️ {t('meal_logging') || "Meal logging"}
                </Label>
                <Switch
                  id="meal-reminder"
                  checked={preferences.reminder_meal_logging}
                  onCheckedChange={(checked) => updatePreference("reminder_meal_logging", checked)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="water-reminder" className="text-sm">
                  💧 {t('water_tracking') || "Water tracking"}
                </Label>
                <Switch
                  id="water-reminder"
                  checked={preferences.reminder_water_logging}
                  onCheckedChange={(checked) => updatePreference("reminder_water_logging", checked)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly-summary" className="text-sm">
                  📊 {t('weekly_summary') || "Weekly summary"}
                </Label>
                <Switch
                  id="weekly-summary"
                  checked={preferences.reminder_weekly_summary}
                  onCheckedChange={(checked) => updatePreference("reminder_weekly_summary", checked)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              {t('reminder_timezone_note') || `Sent in your timezone (${preferences.reminder_timezone.split('/').pop()?.replace('_', ' ')})`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
