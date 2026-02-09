import { useState, useEffect } from "react";
import { Bell, Mail, Smartphone, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface ReminderPreferences {
  reminders_enabled: boolean;
  reminder_frequency: string;
  reminder_timezone: string;
}

const FREQUENCY_OPTIONS = [
  { value: "light", label: "Light", description: "Morning check-in only" },
  { value: "standard", label: "Standard", description: "Morning + daytime follow-ups" },
];

export const ReminderSettings = () => {
  const { t } = useLanguage();
  const push = usePushNotifications();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    reminders_enabled: false,
    reminder_frequency: "standard",
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
        .select("reminders_enabled, reminder_frequency, reminder_timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences({
          reminders_enabled: data.reminders_enabled ?? false,
          reminder_frequency: data.reminder_frequency === "light" ? "light" : "standard",
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
        {/* Email Reminders Toggle */}
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

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="push-enabled" className="text-sm">
              Push Notifications
            </Label>
          </div>
          {push.canEnable ? (
            <Switch
              id="push-enabled"
              checked={push.isSubscribed}
              onCheckedChange={async (checked) => {
                if (checked) {
                  const ok = await push.subscribe();
                  if (ok) toast.success("Push notifications enabled");
                  else if (push.permission === "denied") toast.error("Notifications blocked in browser settings");
                  else toast.error("Could not enable push notifications");
                } else {
                  const ok = await push.unsubscribe();
                  if (ok) toast.success("Push notifications disabled");
                }
              }}
              disabled={push.isLoading}
            />
          ) : (
            <span className="text-xs text-muted-foreground">
              {!push.isSupported ? "Not supported" : ""}
            </span>
          )}
        </div>

        {push.showIOSGuidance && (
          <p className="text-xs text-primary bg-primary/10 rounded-lg p-3">
            📱 To enable push notifications on iOS, first add this app to your Home Screen: tap the <strong>Share</strong> button → <strong>Add to Home Screen</strong>, then open it from there.
          </p>
        )}

        {push.isSubscribed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={async () => {
              const ok = await push.sendTest();
              if (ok) toast.success("Test notification sent!");
              else toast.error("Failed to send test notification");
            }}
          >
            <Send className="w-3 h-3 mr-1.5" />
            Send Test Notification
          </Button>
        )}

        {/* Frequency selector – only shown when email reminders are ON */}
        {preferences.reminders_enabled && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm">
                {t('how_often') || "Frequency"}
              </Label>
              <Select
                value={preferences.reminder_frequency}
                onValueChange={(value) => updatePreference("reminder_frequency", value)}
                disabled={isSaving}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {preferences.reminder_frequency === "light"
                ? "You'll get a morning check-in email at 7 AM."
                : "Morning check-in at 7 AM + up to 2 follow-ups if you haven't logged yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              Timezone: {preferences.reminder_timezone.split('/').pop()?.replace('_', ' ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
