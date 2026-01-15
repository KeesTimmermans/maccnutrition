import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserBaseline } from "@/lib/userService";
import { Brain, Utensils, Target, Eye, Clock, Zap } from "lucide-react";

interface PersonalityProfileCardProps {
  baseline: UserBaseline | null;
}

export const PersonalityProfileCard = ({ baseline }: PersonalityProfileCardProps) => {
  if (!baseline) return null;

  const getEatingStyleSummary = () => {
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
    const items: { icon: React.ReactNode; text: string }[] = [];
    
    // Based on eating patterns
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
    
    // Default if nothing specific
    if (items.length === 0) {
      items.push({ icon: <Target className="w-3.5 h-3.5" />, text: 'Daily consistency' });
      items.push({ icon: <Zap className="w-3.5 h-3.5" />, text: 'Energy levels' });
    }
    
    return items.slice(0, 4);
  };

  const hasPersonalityData = baseline.eating_speed || baseline.biggest_challenge || 
    baseline.emotional_eating || baseline.snacking_habits || baseline.energy_patterns;

  if (!hasPersonalityData) {
    return null;
  }

  return (
    <Card variant="glass" className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-accent/20">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <CardTitle className="text-lg">Your Personality Profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eating Style */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Utensils className="w-4 h-4 text-primary" />
            <span>Eating Style</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {getEatingStyleSummary()}
          </p>
        </div>

        {/* Challenges */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="w-4 h-4 text-secondary" />
            <span>Your Challenges</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {getChallengesSummary()}
          </p>
        </div>

        {/* What Coach Mac is watching */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Eye className="w-4 h-4 text-accent" />
            <span>Coach Mac is watching for</span>
          </div>
          <div className="flex flex-wrap gap-2 pl-6">
            {getWatchingForItems().map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-muted/50 text-muted-foreground border border-border/50"
              >
                {item.icon}
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
