import { useState, useEffect } from "react";
import { Ruler, Watch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { MeasurementsSettings } from "@/components/MeasurementsSettings";
import { WearableSettings } from "@/components/WearableSettings";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { useLanguage } from "@/lib/i18n";

const Metrics = () => {
  const { t } = useLanguage();
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showWearableSettings, setShowWearableSettings] = useState(false);

  useEffect(() => {
    loadBaseline();
  }, []);

  const loadBaseline = async () => {
    try {
      const data = await getUserBaseline();
      setBaseline(data);
    } catch (error) {
      console.error("Error loading baseline:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        {/* Body Measurements */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Ruler className="w-5 h-5 text-primary" />
              {t('body_measurements') || 'Body Measurements'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <MeasurementsSettings baseline={baseline} onUpdate={loadBaseline} />
          </CardContent>
        </Card>

        {/* Wearable Devices */}
        <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Watch className="w-5 h-5 text-primary" />
              {t('wearable_devices') || 'Wearable Devices'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t('wearable_description') || 'Connect your fitness trackers to auto-fill check-in data and get personalized insights.'}
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setShowWearableSettings(true)}
            >
              <Watch className="w-4 h-4 mr-2" />
              {t('manage_wearables') || 'Manage Wearable Connections'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Wearable Settings Overlay */}
      {showWearableSettings && (
        <WearableSettings onClose={() => setShowWearableSettings(false)} />
      )}
    </AppLayout>
  );
};

export default Metrics;
