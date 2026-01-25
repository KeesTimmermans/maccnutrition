import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, LogOut, Globe, Crown, Brain, Utensils, Target, Eye, Clock, Zap, LayoutGrid, Ruler, Sparkles, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, UserBaseline } from "@/lib/userService";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage, Language, languageNames } from "@/lib/i18n";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayoutSettings } from "@/components/DashboardLayoutSettings";
import { MeasurementsSettings } from "@/components/MeasurementsSettings";
import { ProgressUpdateDialog } from "@/components/ProgressUpdateDialog";
import { ProgressHistory } from "@/components/ProgressHistory";

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
  const [currency, setCurrency] = useState(baseline?.preferred_currency || "USD");
  const [coachingTone, setCoachingTone] = useState(baseline?.coaching_tone || "supportive");
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showProgressUpdate, setShowProgressUpdate] = useState(false);

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

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ preferred_currency: newCurrency });
      const currencyInfo = currencies.find(c => c.code === newCurrency);
      toast.success(`${t('settings_updated')}: ${currencyInfo?.name || newCurrency}`);
      onSettingsChange?.();
    } catch (error) {
      console.error("Error updating currency:", error);
      toast.error(t('error'));
      setCurrency(baseline?.preferred_currency || "USD");
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

  const handleCoachingToneChange = async (newTone: string) => {
    setCoachingTone(newTone);
    setIsUpdating(true);
    
    try {
      await updateUserSettings({ coaching_tone: newTone });
      const toneInfo = coachingTones.find(t => t.value === newTone);
      toast.success(`Coaching style updated: ${toneInfo?.label || newTone}`);
      onSettingsChange?.();
    } catch (error) {
      console.error("Error updating coaching tone:", error);
      toast.error(t('error'));
      setCoachingTone(baseline?.coaching_tone || "supportive");
    } finally {
      setIsUpdating(false);
    }
  };

  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    navigate("/auth", { replace: true });
    toast.success(t("logout"));
  };

  // Eating profile helper functions
  const getEatingStyleSummary = () => {
    if (!baseline) return 'Getting to know you...';
    const styles: string[] = [];
    
    if (baseline.eating_speed === 'fast') styles.push('Fast eater');
    else if (baseline.eating_speed === 'slow') styles.push('Mindful eater');
    else if (baseline.eating_speed === 'moderate') styles.push('Balanced pace');
    
    if (baseline.snacking_habits === 'frequent') styles.push('Frequent snacker');
    else if (baseline.snacking_habits === 'rarely') styles.push('Structured meals');
    
    if (baseline.emotional_eating === 'often' || baseline.emotional_eating === 'sometimes') {
      styles.push('Comfort seeker');
    }
    
    return styles.length > 0 ? styles.join(' • ') : 'Getting to know you...';
  };

  const getChallengesSummary = () => {
    if (!baseline) return 'No major challenges identified';
    const challenges: string[] = [];
    
    if (baseline.biggest_challenge) {
      const challengeMap: Record<string, string> = {
        'portion_control': 'Portion control',
        'consistency': 'Staying consistent',
        'cravings': 'Managing cravings',
        'meal_planning': 'Meal planning',
        'time': 'Finding time to eat well',
        'motivation': 'Staying motivated',
        'emotional_eating': 'Emotional eating',
        'social_situations': 'Social eating situations',
      };
      challenges.push(challengeMap[baseline.biggest_challenge] || baseline.biggest_challenge);
    }
    
    if (baseline.cravings_triggers && baseline.cravings_triggers.length > 0) {
      const triggerMap: Record<string, string> = {
        'stress': 'Stress',
        'boredom': 'Boredom',
        'fatigue': 'Fatigue',
        'emotions': 'Emotions',
        'social': 'Social settings',
      };
      const triggers = baseline.cravings_triggers
        .slice(0, 2)
        .map(t => triggerMap[t] || t)
        .join(', ');
      if (triggers) challenges.push(`Triggers: ${triggers}`);
    }
    
    return challenges.length > 0 ? challenges.join(' • ') : 'No major challenges identified';
  };

  const getWatchingForItems = () => {
    if (!baseline) return [
      { icon: <Target className="w-3.5 h-3.5" />, text: 'Daily consistency' },
      { icon: <Zap className="w-3.5 h-3.5" />, text: 'Energy levels' },
    ];
    
    const items: { icon: React.ReactNode; text: string }[] = [];
    
    if (baseline.eating_speed === 'fast') {
      items.push({ icon: <Clock className="w-3.5 h-3.5" />, text: 'Meal pacing' });
    }
    
    if (baseline.hunger_patterns === 'irregular' || baseline.hunger_patterns === 'always_hungry') {
      items.push({ icon: <Utensils className="w-3.5 h-3.5" />, text: 'Hunger patterns' });
    }
    
    if (baseline.energy_patterns === 'afternoon_slump' || baseline.energy_patterns === 'inconsistent') {
      items.push({ icon: <Zap className="w-3.5 h-3.5" />, text: 'Energy dips' });
    }
    
    if (baseline.weekend_habits === 'different' || baseline.weekend_habits === 'indulgent') {
      items.push({ icon: <Target className="w-3.5 h-3.5" />, text: 'Weekend consistency' });
    }
    
    if (baseline.emotional_eating === 'often' || baseline.emotional_eating === 'sometimes') {
      items.push({ icon: <Brain className="w-3.5 h-3.5" />, text: 'Emotional triggers' });
    }
    
    if (baseline.snacking_habits === 'frequent' || baseline.snacking_habits === 'late_night') {
      items.push({ icon: <Utensils className="w-3.5 h-3.5" />, text: 'Snack patterns' });
    }
    
    if (items.length === 0) {
      items.push({ icon: <Target className="w-3.5 h-3.5" />, text: 'Daily consistency' });
      items.push({ icon: <Zap className="w-3.5 h-3.5" />, text: 'Energy levels' });
    }
    
    return items.slice(0, 4);
  };

  const hasPersonalityData = baseline?.eating_speed || baseline?.biggest_challenge || 
    baseline?.emotional_eating || baseline?.snacking_habits || baseline?.energy_patterns;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-muted rounded-xl transition-colors">
          <Settings className="w-6 h-6 text-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent className="flex flex-col h-full p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <SheetTitle>{t('settings')}</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mb-2 grid w-auto grid-cols-4 flex-shrink-0">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="measurements">Body</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6">
            <TabsContent value="general" className="mt-0">
              <div className="space-y-6 pb-6">
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

                {/* Currency */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">{t('currency') || 'Currency'}</h3>
                  <div className="p-4 bg-muted rounded-xl">
                    <p className="text-xs text-muted-foreground mb-3">
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
            </TabsContent>

            <TabsContent value="layout" className="mt-0">
              <div className="space-y-6 pb-6">
                <div className="flex items-center gap-3 pb-2">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <LayoutGrid className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Dashboard Layout</h3>
                    <p className="text-xs text-muted-foreground">Customize your home screen</p>
                  </div>
                </div>

                <DashboardLayoutSettings
                  currentLayout={baseline?.dashboard_layout || null}
                  onLayoutChange={onSettingsChange}
                />
              </div>
            </TabsContent>

            <TabsContent value="measurements" className="mt-0">
              <div className="space-y-6 pb-6">
                <div className="flex items-center gap-3 pb-2">
                  <div className="p-2 rounded-xl bg-secondary/10">
                    <Ruler className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Body Measurements</h3>
                    <p className="text-xs text-muted-foreground">Track your progress beyond the scale</p>
                  </div>
                </div>

                {/* Monthly Progress Check-in Button */}
                <div className="p-4 bg-muted rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Monthly Progress Check-in</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Update your measurements, share how you're feeling about your progress, or let Coach Mac know you want to push harder.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowProgressUpdate(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Progress Check-in
                  </Button>
                  {baseline?.last_progress_update && (
                    <p className="text-xs text-muted-foreground text-center">
                      Last check-in: {new Date(baseline.last_progress_update).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <MeasurementsSettings
                  baseline={baseline}
                  onUpdate={onSettingsChange}
                />

                {/* Progress History Section */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Check-in History</span>
                  </div>
                  <ProgressHistory 
                    unitSystem={baseline?.unit_system === "metric" ? "metric" : "imperial"} 
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="profile" className="mt-0">
              <div className="space-y-6 pb-6">
                {/* Coaching Style Selector */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Coaching Style</h3>
                      <p className="text-xs text-muted-foreground">How Coach Mac communicates with you</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-xl">
                    <Select value={coachingTone} onValueChange={handleCoachingToneChange} disabled={isUpdating}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select coaching style" />
                      </SelectTrigger>
                      <SelectContent>
                        {coachingTones.map((tone) => (
                          <SelectItem key={tone.value} value={tone.value}>
                            <div className="flex flex-col">
                              <span>{tone.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      {coachingTones.find(t => t.value === coachingTone)?.description || 'Choose how you prefer to receive advice'}
                    </p>
                  </div>
                </div>

                {hasPersonalityData ? (
                  <>
                    {/* Header */}
                    <div className="flex items-center gap-3 pb-2">
                      <div className="p-2 rounded-xl bg-accent/20">
                        <Brain className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Your Eating Personality</h3>
                        <p className="text-xs text-muted-foreground">Based on your onboarding responses</p>
                      </div>
                    </div>

                    {/* Eating Style */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Utensils className="w-4 h-4 text-primary" />
                        <span>Eating Style</span>
                      </div>
                      <div className="p-3 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground">
                          {getEatingStyleSummary()}
                        </p>
                      </div>
                    </div>

                    {/* Challenges */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Target className="w-4 h-4 text-secondary" />
                        <span>Your Challenges</span>
                      </div>
                      <div className="p-3 bg-muted rounded-xl">
                        <p className="text-sm text-muted-foreground">
                          {getChallengesSummary()}
                        </p>
                      </div>
                    </div>

                    {/* What Coach Mac is watching */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Eye className="w-4 h-4 text-accent" />
                        <span>Coach Mac is watching for</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getWatchingForItems().map((item, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground border border-border/50"
                          >
                            {item.icon}
                            {item.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Complete your profile to see your eating personality insights.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </SheetContent>

      {/* Progress Update Dialog */}
      <ProgressUpdateDialog
        open={showProgressUpdate}
        onOpenChange={setShowProgressUpdate}
        baseline={baseline}
        onComplete={() => {
          onSettingsChange?.();
        }}
      />
    </Sheet>
  );
};
