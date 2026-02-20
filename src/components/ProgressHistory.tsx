import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getProgressUpdates, ProgressUpdate } from "@/lib/progressUpdateService";
import { ThumbsUp, Target, Ruler, TrendingUp, MessageCircle, Scale, Activity, Loader2 } from "lucide-react";

interface ProgressHistoryProps {
  unitSystem?: "imperial" | "metric";
}

export const ProgressHistory = ({ unitSystem = "metric" }: ProgressHistoryProps) => {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getProgressUpdates();
        setUpdates(data);
      } catch (error) {
        console.error("Error loading progress history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, []);

  const getChoiceIcon = (choice: string) => {
    // Support new composite format: "status__intent"
    const status = choice.split("__")[0];
    switch (status) {
      case "happy":
      case "on_track":
        return <ThumbsUp className="w-4 h-4 text-accent" />;
      case "more_progress":
      case "slower_than_expected":
        return <Target className="w-4 h-4 text-primary" />;
      case "update_measurements":
      case "faster_than_expected":
        return <TrendingUp className="w-4 h-4 text-accent" />;
      case "no_change":
        return <Ruler className="w-4 h-4 text-secondary" />;
      default:
        return null;
    }
  };

  const getChoiceLabel = (choice: string) => {
    const parts = choice.split("__");
    const status = parts[0];
    const intent = parts[1];
    const labels: Record<string, string> = {
      happy: "Happy with progress",
      more_progress: "Wanted more progress",
      update_measurements: "Updated measurements",
      on_track: "On track",
      slower_than_expected: "Slower than expected",
      faster_than_expected: "Faster than expected",
      no_change: "No change",
    };
    const intentLabels: Record<string, string> = {
      keep_plan: "Keeping plan",
      increase_rate: "Pushing harder",
      reduce_fatigue: "Reducing fatigue",
      diet_break: "Diet break",
    };
    let label = labels[status] || status;
    if (intent && intentLabels[intent]) label += ` · ${intentLabels[intent]}`;
    return label;
  };

  const formatWeight = (weight: number | null) => {
    if (!weight) return null;
    if (unitSystem === "imperial") {
      return `${Math.round(weight * 2.20462)} lbs`;
    }
    return `${weight} kg`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No progress check-ins yet.</p>
        <p className="text-xs mt-1">Complete your first bi-weekly check-in to see your history here.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <Accordion type="single" collapsible className="space-y-2">
        {updates.map((update, index) => (
          <AccordionItem
            key={update.id}
            value={update.id}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                {getChoiceIcon(update.satisfaction_choice)}
                <div>
                  <p className="font-medium text-sm">
                    {format(new Date(update.created_at), "MMMM d, yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getChoiceLabel(update.satisfaction_choice)}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-4">
              {/* Adjustments made */}
              {update.adjustments && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Targets Adjusted</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {update.adjustments.reason && (
                      <p>{update.adjustments.reason}</p>
                    )}
                    <div className="flex gap-4 mt-2">
                      {update.adjustments.calorieChange !== undefined && update.adjustments.calorieChange !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          Calories: {update.adjustments.calorieChange > 0 ? "+" : ""}{update.adjustments.calorieChange}
                        </Badge>
                      )}
                      {update.adjustments.proteinChange !== undefined && update.adjustments.proteinChange !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          Protein: {update.adjustments.proteinChange > 0 ? "+" : ""}{update.adjustments.proteinChange}g
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Targets at time of check-in */}
              {(update.target_calories || update.protein_grams) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {update.target_calories && (
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Calories:</span>{" "}
                      <span className="font-medium">{update.target_calories}</span>
                    </div>
                  )}
                  {update.protein_grams && (
                    <div className="p-2 rounded bg-muted/50">
                      <span className="text-muted-foreground">Protein:</span>{" "}
                      <span className="font-medium">{update.protein_grams}g</span>
                    </div>
                  )}
                </div>
              )}

              {/* Measurements snapshot */}
              {(update.weight || update.body_fat_percentage || update.waist_cm) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Measurements</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {update.weight && (
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground block">Weight</span>
                        <span className="font-medium">{formatWeight(update.weight)}</span>
                      </div>
                    )}
                    {update.body_fat_percentage && (
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground block">Body Fat</span>
                        <span className="font-medium">{update.body_fat_percentage}%</span>
                      </div>
                    )}
                    {update.waist_cm && (
                      <div className="p-2 rounded bg-muted/50">
                        <span className="text-muted-foreground block">Waist</span>
                        <span className="font-medium">{update.waist_cm} cm</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* User feedback */}
              {update.user_feedback && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Your notes:</p>
                  <p className="text-sm italic bg-muted/50 p-2 rounded">
                    "{update.user_feedback}"
                  </p>
                </div>
              )}

              {/* Coach response */}
              {update.coach_response && (
                <div className="space-y-2 p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Coach Mac's Response</span>
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {update.coach_response.split("\n").slice(0, 3).map((p, i) => (
                      <p key={i} className="mb-1">{p}</p>
                    ))}
                    {update.coach_response.split("\n").length > 3 && (
                      <p className="text-xs text-muted-foreground/70">...</p>
                    )}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </ScrollArea>
  );
};
