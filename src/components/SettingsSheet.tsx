import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, LogOut, Globe, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, UserBaseline } from "@/lib/userService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage, Language, languageNames } from "@/lib/i18n";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useAuth } from "@/hooks/useAuth";

interface SettingsSheetProps {
  baseline: UserBaseline | null;
  onSettingsChange?: () => void;
  subscribed?: boolean;
  subscriptionEnd?: string | null;
  subscriptionLoading?: boolean;
  onRefreshSubscription?: () => void;
}

export const SettingsSheet = ({ 
  baseline, 
  onSettingsChange,
  subscribed = false,
  subscriptionEnd = null,
  subscriptionLoading = false,
  onRefreshSubscription = () => {},
}: SettingsSheetProps) => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [isMetric, setIsMetric] = useState(baseline?.unit_system === "metric");
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUnitChange = async (checked: boolean) => {
    setIsMetric(checked);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ unit_system: checked ? "metric" : "imperial" });
      toast.success(`${t('settings_updated')}: ${checked ? t('metric_units_desc') : t('imperial_units_desc')}`);
      onSettingsChange?.();
    } catch (error) {
      console.error("Error updating unit system:", error);
      toast.error(t('error'));
      setIsMetric(!checked);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLanguageChange = async (newLang: Language) => {
    try {
      await setLanguage(newLang);
      toast.success(`${t('language_changed')} ${languageNames[newLang]}`);
      onSettingsChange?.();
    } catch (error) {
      console.error("Error updating language:", error);
      toast.error(t('error'));
    }
  };

  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    navigate("/auth", { replace: true });
    toast.success(t("logout"));
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
          <SheetTitle>{t('settings')}</SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6 mt-6">
          {/* Language Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('language')}
            </h3>
            <div className="p-4 bg-muted rounded-xl">
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('select_language')} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(languageNames) as Language[]).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {languageNames[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unit System */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">{t('display_units')}</h3>
            <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
              <div className="space-y-1">
                <Label htmlFor="unit-toggle" className="text-sm font-medium">
                  {t('use_metric_units')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isMetric ? t('metric_units_desc') : t('imperial_units_desc')}
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
              <h3 className="text-sm font-semibold text-foreground">{t('your_profile')}</h3>
              <div className="p-4 bg-muted rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('goal')}</span>
                  <span className="text-foreground capitalize">
                    {baseline.primary_goal?.replace(/_/g, " ") || t('not_set')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('daily_calories')}</span>
                  <span className="text-foreground">
                    {baseline.target_calories?.toLocaleString() || t('not_set')} kcal
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('activity_level')}</span>
                  <span className="text-foreground capitalize">
                    {baseline.activity_level?.replace(/_/g, " ") || t('not_set')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Subscription */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Subscription
            </h3>
            <SubscriptionCard
              subscribed={subscribed}
              subscriptionEnd={subscriptionEnd}
              loading={subscriptionLoading}
              onRefresh={onRefreshSubscription}
            />
          </div>

          {/* Logout */}
          <div className="pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
