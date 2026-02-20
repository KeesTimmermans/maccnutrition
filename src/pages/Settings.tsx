import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Globe, Ruler, Crown, LayoutGrid, MessageSquare, Trash2, BarChart2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getUserBaseline, updateUserSettings, UserBaseline } from "@/lib/userService";
import { useLanguage, Language, languageNames } from "@/lib/i18n";
import { DashboardLayoutSettings } from "@/components/DashboardLayoutSettings";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { supabase } from "@/integrations/supabase/client";
import { initAnalytics, identifyUser, shutdownAnalytics } from "@/lib/analytics";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [isMetric, setIsMetric] = useState(false);
  const [currency, setCurrency] = useState("GBP");
  const [coachingTone, setCoachingTone] = useState("supportive");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [communityAnonymous, setCommunityAnonymous] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const coachingTones = [
    { value: "direct", label: "Direct", description: "Concise and action-focused" },
    { value: "supportive", label: "Supportive", description: "Warm and encouraging" },
    { value: "educational", label: "Educational", description: "Explains the 'why' behind advice" },
    { value: "motivational", label: "Motivational", description: "High-energy and action-oriented" },
  ];

  const currencies = [
    { code: "GBP", symbol: "£", name: "British Pound" },
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success("Your account has been deleted.");
      await supabase.auth.signOut();
      localStorage.clear();
      navigate("/auth");
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error("Failed to delete account. Please contact support@macnutrition.co.uk");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [baselineData] = await Promise.all([
        getUserBaseline(),
        checkSubscription(),
      ]);
      
      if (baselineData) {
        setBaseline(baselineData);
        setIsMetric(baselineData.unit_system === "metric");
        setCurrency(baselineData.preferred_currency || "GBP");
        setCoachingTone(baselineData.coaching_tone || "supportive");
        setAnalyticsConsent((baselineData as any).analytics_consent ?? false);
      }

      // Load community anonymity from profiles
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("community_anonymous")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setCommunityAnonymous(profile?.community_anonymous ?? false);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyticsConsentChange = async (enabled: boolean) => {
    setAnalyticsConsent(enabled);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase
        .from("user_baselines")
        .update({ analytics_consent: enabled })
        .eq("user_id", session.user.id);
      if (enabled) {
        initAnalytics();
        identifyUser(session.user.id);
        toast.success("Analytics sharing enabled");
      } else {
        shutdownAnalytics();
        toast.success("Analytics sharing disabled");
      }
    } catch (err) {
      console.error("Error updating analytics consent:", err);
      toast.error("Failed to update analytics preference");
      setAnalyticsConsent(!enabled);
    }
  };

  const checkSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      
      setSubscribed(data?.subscribed || false);
      setSubscriptionEnd(data?.subscription_end || null);
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleUnitChange = async (checked: boolean) => {
    setIsMetric(checked);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ unit_system: checked ? "metric" : "imperial" });
      toast.success(`${t('settings_updated')}: ${checked ? t('metric_units_desc') : t('imperial_units_desc')}`);
    } catch (error) {
      console.error("Error updating unit system:", error);
      toast.error(t('error'));
      setIsMetric(!checked);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ preferred_currency: newCurrency });
      const currencyInfo = currencies.find(c => c.code === newCurrency);
      toast.success(`${t('settings_updated')}: ${currencyInfo?.name || newCurrency}`);
    } catch (error) {
      console.error("Error updating currency:", error);
      toast.error(t('error'));
      setCurrency(baseline?.preferred_currency || "GBP");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLanguageChange = async (newLang: Language) => {
    try {
      await setLanguage(newLang);
      toast.success(`${t('language_changed')} ${languageNames[newLang]}`);
    } catch (error) {
      console.error("Error updating language:", error);
      toast.error(t('error'));
    }
  };

  const handleCoachingToneChange = async (newTone: string) => {
    setCoachingTone(newTone);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ coaching_tone: newTone });
      const toneInfo = coachingTones.find(t => t.value === newTone);
      toast.success(`Coaching style updated: ${toneInfo?.label || newTone}`);
    } catch (error) {
      console.error("Error updating coaching tone:", error);
      toast.error(t('error'));
      setCoachingTone(baseline?.coaching_tone || "supportive");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="animate-pulse text-muted-foreground">Loading settings...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            aria-label="Back to Profile"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">{t('settings')}</h1>
        </div>

        {/* Language Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              {t('language')}
            </CardTitle>
            <CardDescription className="text-xs">
              Choose your preferred language
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Units & Currency Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="w-4 h-4 text-primary" />
              {t('display_units')} & {t('currency') || 'Currency'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Unit System Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
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

            <Separator />

            {/* Currency Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('currency') || 'Currency'}</Label>
              <p className="text-xs text-muted-foreground">
                {t('currency_desc') || 'Used for grocery list cost estimates'}
              </p>
              <Select value={currency} onValueChange={handleCurrencyChange} disabled={isUpdating}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('select_currency') || 'Select currency'} />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Coaching Tone Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Coaching Style
            </CardTitle>
            <CardDescription className="text-xs">
              How Coach Mac communicates with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={coachingTone} onValueChange={handleCoachingToneChange} disabled={isUpdating}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {coachingTones.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    <div className="flex flex-col">
                      <span>{tone.label}</span>
                      <span className="text-xs text-muted-foreground">{tone.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Dashboard Layout Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-primary" />
              Dashboard Layout
            </CardTitle>
            <CardDescription className="text-xs">
              Customize your home screen sections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardLayoutSettings
              currentLayout={baseline?.dashboard_layout || null}
              onLayoutChange={loadData}
            />
          </CardContent>
        </Card>

        {/* Subscription Section */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2 px-1">
            <Crown className="w-4 h-4 text-primary" />
            Subscription
          </h2>
          <SubscriptionCard
            subscribed={subscribed}
            subscriptionEnd={subscriptionEnd}
            loading={subscriptionLoading}
            onRefresh={checkSubscription}
          />
        </div>

        {/* Analytics Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Analytics Sharing
            </CardTitle>
            <CardDescription className="text-xs">
              Help improve MacNutrition by sharing anonymous usage events (no food names, macros, or health data). Default off for UK users (GDPR).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="analytics-toggle" className="text-sm font-medium">
                  Analytics sharing
                </Label>
                <p className="text-xs text-muted-foreground">
                  {analyticsConsent ? "Enabled — anonymous usage events are sent" : "Disabled — no data is sent"}
                </p>
              </div>
              <Switch
                id="analytics-toggle"
                checked={analyticsConsent}
                onCheckedChange={handleAnalyticsConsentChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Community Anonymity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Community Privacy
            </CardTitle>
            <CardDescription className="text-xs">
              When enabled, all your posts and comments appear as "Anonymous" to other users. Admins can still see your identity for moderation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="anon-toggle" className="text-sm font-medium">
                  Post anonymously
                </Label>
                <p className="text-xs text-muted-foreground">
                  {communityAnonymous ? "Your identity is hidden in the community" : "Your display name is visible"}
                </p>
              </div>
              <Switch
                id="anon-toggle"
                checked={communityAnonymous}
                onCheckedChange={async (enabled) => {
                  setCommunityAnonymous(enabled);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    const { error } = await supabase
                      .from("profiles")
                      .update({ community_anonymous: enabled } as any)
                      .eq("user_id", session.user.id);
                    if (error) throw error;
                    toast.success(enabled ? "You'll now post anonymously" : "Your display name is now visible");
                  } catch (err) {
                    console.error("Error updating anonymity:", err);
                    toast.error("Failed to update setting");
                    setCommunityAnonymous(!enabled);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="w-4 h-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-xs">
              Permanently delete your account and all associated data. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting}>
                  {isDeleting ? "Deleting…" : "Delete my account"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account, cancel any active subscription, and erase all your data — meals, metrics, progress photos, reminders, and preferences. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
