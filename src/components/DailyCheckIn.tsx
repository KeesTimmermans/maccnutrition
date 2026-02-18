import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SafeAreaContainer } from "@/components/layout/SafeAreaContainer";
import { 
  X, 
  Sun, 
  Moon, 
  Battery, 
  Brain, 
  Smile, 
  Loader2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles
} from "lucide-react";
import { getTodaysCheckIn, saveCheckIn, getRecentCheckIns, analyzeCheckIns, type DailyCheckIn as DailyCheckInData, type CheckInAnalysis } from "@/lib/checkinService";
import { trackCheckinCompleted } from "@/lib/analytics";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface CheckInData {
  mood: number;
  energy_level: number;
  sleep_quality: number;
  stress_level: number;
  sleep_hours?: number;
  hunger_level?: number;
  notes?: string;
  check_in_date: string;
}

interface DailyCheckInComponentProps {
  onClose: () => void;
  onComplete: (data: CheckInData) => void;
}

type MetricKey = 'mood' | 'energy' | 'sleep' | 'stress';

const EMOJI_SCALE = ['😫', '😕', '😐', '🙂', '😊'];

export const DailyCheckIn = ({ onClose, onComplete }: DailyCheckInComponentProps) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingCheckIn, setExistingCheckIn] = useState<DailyCheckInData | null>(null);
  const [analysis, setAnalysis] = useState<CheckInAnalysis | null>(null);
  
  const [formData, setFormData] = useState({
    mood: 3,
    energy: 3,
    sleep: 3,
    stress: 3,
    sleepHours: '',
    notes: '',
  });

  const METRIC_CONFIG: Record<MetricKey, { 
    label: string; 
    icon: React.ReactNode; 
    lowLabel: string; 
    highLabel: string;
    color: string;
  }> = {
    mood: { 
      label: t('hows_your_mood'), 
      icon: <Smile className="w-5 h-5" />, 
      lowLabel: t('low'), 
      highLabel: t('great'),
      color: "text-amber-500"
    },
    energy: { 
      label: t('energy_level'), 
      icon: <Battery className="w-5 h-5" />, 
      lowLabel: t('drained'), 
      highLabel: t('energized'),
      color: "text-green-500"
    },
    sleep: { 
      label: t('sleep_quality'), 
      icon: <Moon className="w-5 h-5" />, 
      lowLabel: t('poor'), 
      highLabel: t('excellent'),
      color: "text-blue-500"
    },
    stress: { 
      label: t('stress_level'), 
      icon: <Brain className="w-5 h-5" />, 
      lowLabel: t('stressed'), 
      highLabel: t('calm'),
      color: "text-purple-500"
    },
  };

  const steps: MetricKey[] = ['mood', 'energy', 'sleep', 'stress'];
  const totalSteps = steps.length + 1; // metrics + notes

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [todaysData, recentData] = await Promise.all([
        getTodaysCheckIn(),
        getRecentCheckIns(7),
      ]);

      if (todaysData) {
        setExistingCheckIn(todaysData);
        setFormData({
          mood: todaysData.mood || 3,
          energy: todaysData.energy_level || 3,
          sleep: todaysData.sleep_quality || 3,
          stress: todaysData.stress_level || 3,
          sleepHours: todaysData.sleep_hours?.toString() || '',
          notes: todaysData.notes || '',
        });
      }

      if (recentData.length > 0) {
        setAnalysis(analyzeCheckIns(recentData));
      }
    } catch (error) {
      console.error('Error loading check-in data:', error);
    }
    setLoading(false);
  };

  const handleMetricChange = (metric: MetricKey, value: number) => {
    setFormData(prev => ({ ...prev, [metric]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const checkInData: CheckInData = {
        check_in_date: new Date().toISOString().split('T')[0],
        mood: formData.mood,
        energy_level: formData.energy,
        sleep_quality: formData.sleep,
        stress_level: formData.stress,
        sleep_hours: formData.sleepHours ? parseFloat(formData.sleepHours) : undefined,
        notes: formData.notes || undefined,
      };
      
      await saveCheckIn({
        check_in_date: checkInData.check_in_date,
        mood: checkInData.mood,
        energy_level: checkInData.energy_level,
        sleep_quality: checkInData.sleep_quality,
        stress_level: checkInData.stress_level,
        sleep_hours: checkInData.sleep_hours,
        notes: checkInData.notes,
      });
      trackCheckinCompleted();
      toast.success(t('checkin_saved'));
      onComplete(checkInData);
    } catch (error) {
      toast.error(t('checkin_failed'));
      console.error('Error saving check-in:', error);
    }
    setSaving(false);
  };

  const getTrendIcon = (trend: "improving" | "declining" | "stable") => {
    if (trend === "improving") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <SafeAreaContainer overlay className="bg-background/95 backdrop-blur-sm items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </SafeAreaContainer>
    );
  }

  const currentMetric = steps[step] as MetricKey | undefined;
  const isNotesStep = step === steps.length;

  return (
    <SafeAreaContainer overlay className="bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-foreground">{t('daily_checkin')}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Progress */}
      <div className="px-6 pt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {t('step_of').replace('{current}', String(step + 1)).replace('{total}', String(totalSteps))}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {currentMetric && !isNotesStep && (
          <div className="w-full max-w-sm animate-slide-up">
            <div className="text-center mb-8">
              <div className={`w-16 h-16 rounded-2xl bg-card shadow-soft flex items-center justify-center mx-auto mb-4 ${METRIC_CONFIG[currentMetric].color}`}>
                {METRIC_CONFIG[currentMetric].icon}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {METRIC_CONFIG[currentMetric].label}
              </h3>
              
              {/* Trend indicator if available */}
              {analysis && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>{t('seven_day_avg')}: {
                    currentMetric === 'mood' ? analysis.averageMood :
                    currentMetric === 'energy' ? analysis.averageEnergy :
                    currentMetric === 'sleep' ? analysis.averageSleep :
                    analysis.averageStress
                  }/5</span>
                  {getTrendIcon(analysis.trends[currentMetric])}
                </div>
              )}
            </div>

            {/* Emoji Scale */}
            <div className="flex justify-between items-center mb-4">
              {EMOJI_SCALE.map((emoji, index) => {
                const value = index + 1;
                const isSelected = formData[currentMetric] === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleMetricChange(currentMetric, value)}
                    className={`w-14 h-14 rounded-2xl text-2xl transition-all ${
                      isSelected 
                        ? 'bg-primary scale-110 shadow-medium' 
                        : 'bg-card shadow-soft hover:scale-105'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{METRIC_CONFIG[currentMetric].lowLabel}</span>
              <span>{METRIC_CONFIG[currentMetric].highLabel}</span>
            </div>

            {/* Sleep hours input for sleep step */}
            {currentMetric === 'sleep' && (
              <div className="mt-6">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  {t('hours_sleep')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.sleepHours}
                  onChange={(e) => setFormData(prev => ({ ...prev, sleepHours: e.target.value }))}
                  placeholder="e.g., 7.5"
                  className="w-full h-12 rounded-xl bg-card shadow-soft px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {isNotesStep && (
          <div className="w-full max-w-sm animate-slide-up">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-card shadow-soft flex items-center justify-center mx-auto mb-4 text-primary">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {t('anything_else')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('optional_context')}
              </p>
            </div>

            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('notes_placeholder')}
              className="min-h-[120px] rounded-xl bg-card shadow-soft resize-none"
            />

            {/* Summary */}
            <div className="mt-6 bg-card rounded-2xl p-4 shadow-soft">
              <h4 className="font-semibold text-foreground mb-3">{t('your_checkin_summary')}</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span>{EMOJI_SCALE[formData.mood - 1]}</span>
                  <span className="text-muted-foreground">{t('mood')}: {formData.mood}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">{t('energy')}: {formData.energy}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">{t('sleep')}: {formData.sleep}/5</span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-muted-foreground">{t('stress')}: {formData.stress}/5</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 flex gap-3 border-t border-border">
        {step > 0 && (
          <Button variant="soft" size="lg" onClick={handleBack} className="flex-1">
            {t('back')}
          </Button>
        )}
        <Button 
          variant="hero" 
          size="lg" 
          onClick={handleNext}
          disabled={saving}
          className="flex-1"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isNotesStep ? (
            existingCheckIn ? t('update_checkin') : t('complete_checkin')
          ) : (
            t('continue')
          )}
        </Button>
      </div>
    </SafeAreaContainer>
  );
};
