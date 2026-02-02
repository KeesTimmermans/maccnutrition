import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Instagram, History, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import { InstagramRecipeImport } from "@/components/InstagramRecipeImport";
import { MealPlanner } from "@/components/MealPlanner";
import { getUserBaseline, UserBaseline } from "@/lib/userService";
import { useLanguage } from "@/lib/i18n";
import { useShareHandler } from "@/hooks/useShareHandler";

const Meals = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [baseline, setBaseline] = useState<UserBaseline | null>(null);
  const [showRecipeImport, setShowRecipeImport] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Handle shared recipe URLs
  const { sharedUrl, clearSharedUrl } = useShareHandler();

  useEffect(() => {
    loadBaseline();
  }, []);

  // Auto-open recipe import when a URL is shared
  useEffect(() => {
    if (sharedUrl) {
      setShowRecipeImport(true);
    }
  }, [sharedUrl]);

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
          <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl border-primary/30 hover:bg-primary/5"
            onClick={() => setShowRecipeImport(true)}
          >
            <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Instagram className="w-5 h-5 text-pink-500" />
            </div>
            <span className="text-sm font-medium">{t('import_recipe') || 'Import Recipe'}</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col items-center gap-2 rounded-2xl border-primary/30 hover:bg-primary/5"
            onClick={() => navigate('/history')}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <History className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-center">{t('meal_history_backlog') || 'Meal History / Backlog'}</span>
          </Button>
        </div>

        {/* Meal Planner */}
        <MealPlanner baseline={baseline} />
      </div>

      {/* Recipe Import Dialog */}
      <InstagramRecipeImport
        open={showRecipeImport}
        onOpenChange={setShowRecipeImport}
        onMealLogged={loadBaseline}
        initialUrl={sharedUrl}
        onInitialUrlProcessed={clearSharedUrl}
      />
    </AppLayout>
  );
};

export default Meals;
