import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  User, 
  Activity, 
  Target, 
  Utensils, 
  Heart,
  Moon,
  Briefcase,
  AlertCircle
} from "lucide-react";
import cjtLogo from "@/assets/cjt-logo.png";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type StepType = "demographics" | "medical" | "lifestyle" | "goals" | "preferences" | "female";

interface OnboardingData {
  // Demographics
  age: string;
  sex: "male" | "female" | "";
  unitSystem: "imperial" | "metric";
  heightFeet: string;
  heightInches: string;
  heightCm: string;
  weight: string;
  
  // Medical & Allergies
  conditions: string[];
  allergies: string[];
  
  // Lifestyle & Activity
  occupation: string;
  workHours: string;
  trainingDays: string;
  trainingIntensity: string;
  sleepHours: string;
  activityLevel: string;
  stressLevel: string;
  
  // Goals
  primaryGoal: string;
  secondaryGoals: string[];
  
  // Preferences
  dietType: string;
  foodDislikes: string;
  coachingTone: string;
  mealsPerDay: string;
  
  // Female-Specific
  cycleRegularity: string;
  currentPhase: string;
  cycleSymptoms: string[];
}

const initialData: OnboardingData = {
  age: "",
  sex: "",
  unitSystem: "imperial",
  heightFeet: "",
  heightInches: "",
  heightCm: "",
  weight: "",
  conditions: [],
  allergies: [],
  occupation: "",
  workHours: "",
  trainingDays: "",
  trainingIntensity: "",
  sleepHours: "",
  activityLevel: "",
  stressLevel: "",
  primaryGoal: "",
  secondaryGoals: [],
  dietType: "",
  foodDislikes: "",
  coachingTone: "",
  mealsPerDay: "",
  cycleRegularity: "",
  currentPhase: "",
  cycleSymptoms: [],
};

const getSteps = (t: (key: string) => string): { id: StepType; title: string; icon: React.ReactNode }[] => [
  { id: "demographics", title: t('about_you'), icon: <User className="w-6 h-6" /> },
  { id: "medical", title: t('health_info'), icon: <Heart className="w-6 h-6" /> },
  { id: "lifestyle", title: t('lifestyle'), icon: <Activity className="w-6 h-6" /> },
  { id: "goals", title: t('your_goals'), icon: <Target className="w-6 h-6" /> },
  { id: "preferences", title: t('preferences'), icon: <Utensils className="w-6 h-6" /> },
];

interface OnboardingQuestionnaireProps {
  onComplete: (data: OnboardingData) => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const { t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  
  const steps = getSteps(t);
  
  const allSteps = data.sex === "female" 
    ? [...steps, { id: "female" as StepType, title: t('cycle_info'), icon: <Moon className="w-6 h-6" /> }]
    : steps;
  
  const currentStep = allSteps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / allSteps.length) * 100;
  
  const updateData = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  };
  
  const toggleArrayItem = (key: keyof OnboardingData, item: string) => {
    setData(prev => {
      const current = prev[key] as string[];
      const updated = current.includes(item) 
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  const handleNext = () => {
    if (currentStepIndex < allSteps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep.id) {
      case "demographics":
        const hasHeight = data.unitSystem === "imperial" ? data.heightFeet : data.heightCm;
        return data.age && data.sex && hasHeight && data.weight;
      case "medical":
        return true; // Optional
      case "lifestyle":
        return data.activityLevel && data.sleepHours && data.trainingDays;
      case "goals":
        return data.primaryGoal;
      case "preferences":
        return data.dietType && data.coachingTone;
      case "female":
        return data.cycleRegularity;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "demographics":
        return <DemographicsStep data={data} updateData={updateData} t={t} />;
      case "medical":
        return <MedicalStep data={data} toggleArrayItem={toggleArrayItem} t={t} />;
      case "lifestyle":
        return <LifestyleStep data={data} updateData={updateData} t={t} />;
      case "goals":
        return <GoalsStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "preferences":
        return <PreferencesStep data={data} updateData={updateData} t={t} />;
      case "female":
        return <FemaleStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Logo */}
      <div className="p-4 flex flex-col items-center">
        <img src={cjtLogo} alt="CJT Nutrition" className="h-12 mb-4" />
        
        {/* Progress bar */}
        <div className="w-full max-w-md">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-hero transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {allSteps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex flex-col items-center transition-colors ${
                  index <= currentStepIndex ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  index < currentStepIndex 
                    ? "bg-primary text-primary-foreground" 
                    : index === currentStepIndex 
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground">
              {currentStep.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{currentStep.title}</h2>
              <p className="text-sm text-muted-foreground">
                {t('step_x_of_y').replace('{current}', String(currentStepIndex + 1)).replace('{total}', String(allSteps.length))}
              </p>
            </div>
          </div>
          
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 flex gap-3 border-t border-border">
        {currentStepIndex > 0 && (
          <Button variant="soft" size="lg" onClick={handleBack} className="flex-1">
            <ChevronLeft className="w-5 h-5 mr-1" />
            {t('back')}
          </Button>
        )}
        <Button
          variant="hero"
          size="lg"
          onClick={handleNext}
          disabled={!canProceed()}
          className="flex-1"
        >
          {currentStepIndex === allSteps.length - 1 ? (
            <>
              {t('complete_setup')}
              <Sparkles className="w-5 h-5 ml-1" />
            </>
          ) : (
            <>
              {t('continue')}
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Step Components
const DemographicsStep = ({ data, updateData, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  t: (key: string) => string;
}) => (
  <div className="space-y-6 animate-slide-up">
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{t('age')}</Label>
      <Input
        type="number"
        placeholder={t('enter_age')}
        value={data.age}
        onChange={(e) => updateData("age", e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">{t('biological_sex')}</Label>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('male'), value: "male" },
          { label: t('female'), value: "female" },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => updateData("sex", option.value as "male" | "female")}
            className={`p-4 rounded-xl text-center transition-all ${
              data.sex === option.value
                ? "bg-primary text-primary-foreground shadow-medium"
                : "bg-card shadow-soft hover:shadow-medium"
            }`}
          >
            <span className="font-semibold">{option.label}</span>
          </button>
        ))}
      </div>
    </div>

    {/* Unit System Toggle */}
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{t('measurement_system')}</Label>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('imperial'), desc: t('ft_in_lbs'), value: "imperial" as const },
          { label: t('metric'), desc: t('cm_kg'), value: "metric" as const },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => updateData("unitSystem", option.value)}
            className={`p-3 rounded-xl text-center transition-all ${
              data.unitSystem === option.value
                ? "bg-primary text-primary-foreground shadow-medium"
                : "bg-card shadow-soft hover:shadow-medium"
            }`}
          >
            <span className="font-semibold block">{option.label}</span>
            <span className={`text-xs ${data.unitSystem === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {option.desc}
            </span>
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">{t('height')}</Label>
      {data.unitSystem === "imperial" ? (
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="number"
              placeholder={t('feet')}
              value={data.heightFeet}
              onChange={(e) => updateData("heightFeet", e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              placeholder={t('inches')}
              value={data.heightInches}
              onChange={(e) => updateData("heightInches", e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
        </div>
      ) : (
        <Input
          type="number"
          placeholder={t('height_in_cm')}
          value={data.heightCm}
          onChange={(e) => updateData("heightCm", e.target.value)}
          className="h-12 rounded-xl"
        />
      )}
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">
        {t('current_weight').replace('{unit}', data.unitSystem === "imperial" ? "lbs" : "kg")}
      </Label>
      <Input
        type="number"
        placeholder={t('enter_weight').replace('{unit}', data.unitSystem === "imperial" ? "lbs" : "kg")}
        value={data.weight}
        onChange={(e) => updateData("weight", e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>
  </div>
);

const MedicalStep = ({ data, toggleArrayItem, t }: { 
  data: OnboardingData; 
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const conditions = [
    { key: "diabetes", label: t('diabetes') },
    { key: "pcos", label: t('pcos') },
    { key: "ibs", label: t('ibs') },
    { key: "thyroid_issues", label: t('thyroid_issues') },
    { key: "high_blood_pressure", label: t('high_blood_pressure') },
    { key: "heart_condition", label: t('heart_condition') },
    { key: "kidney_issues", label: t('kidney_issues') },
    { key: "none", label: t('none') },
  ];
  
  const allergies = [
    { key: "dairy", label: t('dairy') },
    { key: "gluten", label: t('gluten') },
    { key: "nuts", label: t('nuts') },
    { key: "shellfish", label: t('shellfish') },
    { key: "eggs", label: t('eggs') },
    { key: "soy", label: t('soy') },
    { key: "none", label: t('none') },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {t('health_info_notice')}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('health_conditions')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {conditions.map((condition) => (
            <button
              key={condition.key}
              onClick={() => toggleArrayItem("conditions", condition.key)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.conditions.includes(condition.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {condition.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('food_allergies')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {allergies.map((allergy) => (
            <button
              key={allergy.key}
              onClick={() => toggleArrayItem("allergies", allergy.key)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.allergies.includes(allergy.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {allergy.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const LifestyleStep = ({ data, updateData, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  t: (key: string) => string;
}) => {
  const activityLevels = [
    { label: t('not_active'), desc: t('not_active_desc'), value: "not_active" },
    { label: t('semi_active'), desc: t('semi_active_desc'), value: "semi_active" },
    { label: t('active'), desc: t('active_desc'), value: "active" },
    { label: t('very_active'), desc: t('very_active_desc'), value: "very_active" },
  ];

  const trainingOptions = [
    { label: "0-1", value: "0-1" },
    { label: "2-3", value: "2-3" },
    { label: "4-5", value: "4-5" },
    { label: "6+", value: "6+" },
  ];

  const sleepOptions = [
    { label: t('less_than_5'), value: "<5" },
    { label: t('5_6_hours'), value: "5-6" },
    { label: t('7_8_hours'), value: "7-8" },
    { label: t('8_plus_hours'), value: "8+" },
  ];

  const stressLevels = [
    { label: t('low'), value: "low" },
    { label: t('moderate'), value: "moderate" },
    { label: t('high'), value: "high" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('daily_activity_level')}</Label>
        <div className="space-y-2">
          {activityLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => updateData("activityLevel", level.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.activityLevel === level.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{level.label}</span>
              <span className={`text-sm ${data.activityLevel === level.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {level.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('training_days_week')}</Label>
        <div className="grid grid-cols-4 gap-2">
          {trainingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("trainingDays", option.value)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.trainingDays === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('avg_sleep_night')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {sleepOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("sleepHours", option.value)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.sleepHours === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('current_stress_level')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {stressLevels.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("stressLevel", option.value)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.stressLevel === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const GoalsStep = ({ data, updateData, toggleArrayItem, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const primaryGoals = [
    { label: t('fat_loss'), desc: t('fat_loss_desc'), value: "fat_loss", icon: "🔥" },
    { label: t('muscle_gain'), desc: t('muscle_gain_desc'), value: "muscle_gain", icon: "💪" },
    { label: t('performance_goal'), desc: t('performance_desc'), value: "performance", icon: "⚡" },
    { label: t('recovery_goal'), desc: t('recovery_desc'), value: "recovery", icon: "🔄" },
    { label: t('energy_goal'), desc: t('energy_desc'), value: "energy", icon: "✨" },
    { label: t('health_markers'), desc: t('health_markers_desc'), value: "health_markers", icon: "📊" },
    { label: t('general_health'), desc: t('general_health_desc'), value: "general_health", icon: "🌿" },
  ];

  const secondaryGoals = [
    { key: "better_energy", label: t('better_energy') },
    { key: "improved_recovery", label: t('improved_recovery') },
    { key: "better_sleep", label: t('better_sleep') },
    { key: "reduce_inflammation", label: t('reduce_inflammation') },
    { key: "hormone_balance", label: t('hormone_balance') },
    { key: "mental_clarity", label: t('mental_clarity') },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('primary_goal')}</Label>
        <div className="space-y-2">
          {primaryGoals.map((goal) => (
            <button
              key={goal.value}
              onClick={() => updateData("primaryGoal", goal.value)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                data.primaryGoal === goal.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-2xl">{goal.icon}</span>
              <div>
                <span className="font-semibold block">{goal.label}</span>
                <span className={`text-sm ${data.primaryGoal === goal.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {goal.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('secondary_goals')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {secondaryGoals.map((goal) => (
            <button
              key={goal.key}
              onClick={() => toggleArrayItem("secondaryGoals", goal.key)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.secondaryGoals.includes(goal.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {goal.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const PreferencesStep = ({ data, updateData, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  t: (key: string) => string;
}) => {
  const dietTypes = [
    { label: t('omnivore'), desc: t('omnivore_desc'), value: "omnivore" },
    { label: t('pescatarian'), desc: t('pescatarian_desc'), value: "pescatarian" },
    { label: t('vegetarian'), desc: t('vegetarian_desc'), value: "vegetarian" },
    { label: t('vegan'), desc: t('vegan_desc'), value: "vegan" },
  ];

  const coachingTones = [
    { label: t('supportive'), desc: t('supportive_desc'), value: "supportive" },
    { label: t('direct'), desc: t('direct_desc'), value: "direct" },
    { label: t('motivating'), desc: t('motivating_desc'), value: "motivating" },
  ];

  const mealOptions = [
    { label: t('2_meals'), value: "2" },
    { label: t('3_meals'), value: "3" },
    { label: t('4_plus_meals'), value: "4+" },
    { label: t('flexible'), value: "flexible" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('diet_type')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {dietTypes.map((diet) => (
            <button
              key={diet.value}
              onClick={() => updateData("dietType", diet.value)}
              className={`p-4 rounded-xl text-left transition-all ${
                data.dietType === diet.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{diet.label}</span>
              <span className={`text-xs ${data.dietType === diet.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {diet.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('meals_per_day')}</Label>
        <div className="grid grid-cols-4 gap-2">
          {mealOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("mealsPerDay", option.value)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.mealsPerDay === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('coaching_tone')}</Label>
        <div className="space-y-2">
          {coachingTones.map((tone) => (
            <button
              key={tone.value}
              onClick={() => updateData("coachingTone", tone.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.coachingTone === tone.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{tone.label}</span>
              <span className={`text-sm ${data.coachingTone === tone.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {tone.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t('foods_dislike')}</Label>
        <Input
          placeholder={t('foods_dislike_placeholder')}
          value={data.foodDislikes}
          onChange={(e) => updateData("foodDislikes", e.target.value)}
          className="h-12 rounded-xl"
        />
      </div>
    </div>
  );
};

const FemaleStep = ({ data, updateData, toggleArrayItem, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const regularityOptions = [
    { label: t('regular'), desc: t('regular_desc'), value: "regular" },
    { label: t('irregular'), desc: t('irregular_desc'), value: "irregular" },
    { label: t('not_tracking'), desc: t('not_tracking_desc'), value: "not_tracking" },
  ];

  const phaseOptions = [
    { label: t('menstrual'), desc: t('menstrual_desc'), value: "menstrual" },
    { label: t('follicular'), desc: t('follicular_desc'), value: "follicular" },
    { label: t('ovulation'), desc: t('ovulation_desc'), value: "ovulation" },
    { label: t('luteal'), desc: t('luteal_desc'), value: "luteal" },
    { label: t('unsure'), desc: t('unsure_desc'), value: "unsure" },
  ];

  const symptoms = [
    { key: "cravings", label: t('cravings') },
    { key: "fatigue", label: t('fatigue') },
    { key: "bloating", label: t('bloating') },
    { key: "mood_changes", label: t('mood_changes') },
    { key: "low_energy", label: t('low_energy') },
    { key: "sleep_issues", label: t('sleep_issues') },
    { key: "none_minimal", label: t('none_minimal') },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
        <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {t('cycle_info_notice')}
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('cycle_regularity')}</Label>
        <div className="space-y-2">
          {regularityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("cycleRegularity", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.cycleRegularity === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{option.label}</span>
              <span className={`text-sm ${data.cycleRegularity === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {data.cycleRegularity === "regular" && (
        <>
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t('current_phase')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {phaseOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateData("currentPhase", option.value)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    data.currentPhase === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card shadow-soft hover:shadow-medium"
                  }`}
                >
                  <span className="font-semibold block text-sm">{option.label}</span>
                  <span className={`text-xs ${data.currentPhase === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {option.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t('common_symptoms')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {symptoms.map((symptom) => (
                <button
                  key={symptom.key}
                  onClick={() => toggleArrayItem("cycleSymptoms", symptom.key)}
                  className={`p-3 rounded-xl text-sm text-center transition-all ${
                    data.cycleSymptoms.includes(symptom.key)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card shadow-soft hover:shadow-medium"
                  }`}
                >
                  {symptom.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export type { OnboardingData };
