import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  AlertCircle,
  Brain,
  Clock,
  Flame,
  Coffee
} from "lucide-react";
import macLogo from "@/assets/mac-nutrition-logo.png";
import { useLanguage } from "@/lib/i18n/LanguageContext";

import { MeasurementsStep, MeasurementsData } from "@/components/MeasurementsStep";
import { Dumbbell, Ruler as RulerIcon } from "lucide-react";

type StepType = "demographics" | "medical" | "lifestyle" | "eating_behavior" | "challenges" | "goals" | "preferences" | "female" | "measurements";

export interface OnboardingData {
  // Demographics
  name: string;
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
  jobActivityLevel: string;  // NEW: How active is their job
  workoutTypes: string[];    // NEW: Types of workouts they do
  
  // Eating Behavior
  eatingSpeed: string;
  hungerPatterns: string;
  cravingsTriggers: string[];
  emotionalEating: string;
  snackingHabits: string;
  hydrationHabits: string;
  
  // Challenges & History
  biggestChallenge: string;
  pastDiets: string[];
  weekendHabits: string;
  eatingOutFrequency: string;
  
  // Practical
  mealPrepTime: string;
  cookingSkill: string;
  energyPatterns: string;
  
  // Motivation
  motivationStyle: string;
  accountabilityPreference: string;
  
  // Goals
  primaryGoal: string;
  secondaryGoals: string[];
  
  // Preferences
  dietType: string;
  foodDislikes: string;
  coachingTone: string;
  mealsPerDay: string;
  proteinShakesPreference: string;
  
  // Female-Specific
  cycleRegularity: string;
  currentPhase: string;
  cycleSymptoms: string[];

  // Measurements (optional during onboarding)
  bodyFatPercentage: string;
  waist: string;
  hip: string;
  chest: string;
  arm: string;
  thigh: string;
  neck: string;
  hasProgressPhoto: boolean;
  progressPhotoUrl: string | null;
  progressPhotos: {
    front: string | null;
    back: string | null;
    left: string | null;
    right: string | null;
  };
}

const initialData: OnboardingData = {
  name: "",
  age: "",
  sex: "",
  unitSystem: "metric",
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
  jobActivityLevel: "",     // NEW
  workoutTypes: [],         // NEW
  // Eating behavior fields
  eatingSpeed: "",
  hungerPatterns: "",
  cravingsTriggers: [],
  emotionalEating: "",
  snackingHabits: "",
  hydrationHabits: "",
  biggestChallenge: "",
  pastDiets: [],
  weekendHabits: "",
  eatingOutFrequency: "",
  mealPrepTime: "",
  cookingSkill: "",
  energyPatterns: "",
  motivationStyle: "",
  accountabilityPreference: "",
  // Goals & Preferences
  primaryGoal: "",
  secondaryGoals: [],
  dietType: "",
  foodDislikes: "",
  coachingTone: "",
  mealsPerDay: "",
  proteinShakesPreference: "",
  cycleRegularity: "",
  currentPhase: "",
  cycleSymptoms: [],
  // Measurements (optional)
  bodyFatPercentage: "",
  waist: "",
  hip: "",
  chest: "",
  arm: "",
  thigh: "",
  neck: "",
  hasProgressPhoto: false,
  progressPhotoUrl: null,
  progressPhotos: {
    front: null,
    back: null,
    left: null,
    right: null,
  },
};

const getSteps = (t: (key: string) => string): { id: StepType; title: string; icon: React.ReactNode }[] => [
  { id: "demographics", title: t('about_you'), icon: <User className="w-6 h-6" /> },
  { id: "medical", title: t('health_info'), icon: <Heart className="w-6 h-6" /> },
  { id: "lifestyle", title: t('lifestyle'), icon: <Activity className="w-6 h-6" /> },
  { id: "eating_behavior", title: "Eating Habits", icon: <Coffee className="w-6 h-6" /> },
  { id: "challenges", title: "Your Journey", icon: <Brain className="w-6 h-6" /> },
  { id: "goals", title: t('your_goals'), icon: <Target className="w-6 h-6" /> },
  { id: "preferences", title: t('preferences'), icon: <Utensils className="w-6 h-6" /> },
  { id: "measurements", title: "Measurements", icon: <RulerIcon className="w-6 h-6" /> },
];

interface OnboardingQuestionnaireProps {
  onComplete: (data: OnboardingData) => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const { t } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  
  // Pre-fill name from user metadata (support both first_name and legacy full_name)
  useEffect(() => {
    const prefillUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // Extract first name from metadata, handling both first_name and legacy full_name
      let firstName = user?.user_metadata?.first_name;
      if (!firstName && user?.user_metadata?.full_name) {
        // Extract just the first name from full_name
        firstName = user.user_metadata.full_name.split(' ')[0];
      }
      if (firstName) {
        setData(prev => ({ ...prev, name: firstName }));
      }
    };
    prefillUserData();
  }, []);
  
  const steps = getSteps(t);
  
  // Insert female step before measurements if applicable
  const allSteps = data.sex === "female" 
    ? [
        ...steps.slice(0, -1), // All steps except measurements
        { id: "female" as StepType, title: t('cycle_info'), icon: <Moon className="w-6 h-6" /> },
        steps[steps.length - 1] // Measurements at the end
      ]
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const canProceed = () => {
    switch (currentStep.id) {
      case "demographics":
        const hasHeight = data.unitSystem === "imperial" ? data.heightFeet : data.heightCm;
        return data.age && data.sex && hasHeight && data.weight;
      case "medical":
        return true;
      case "lifestyle":
        return data.activityLevel && data.sleepHours && data.trainingDays;
      case "eating_behavior":
        return data.eatingSpeed && data.hungerPatterns;
      case "challenges":
        return data.biggestChallenge && data.mealPrepTime;
      case "goals":
        return data.primaryGoal;
      case "preferences":
        return data.dietType && data.coachingTone;
      case "female":
        return data.cycleRegularity;
      case "measurements":
        return true; // Measurements are optional
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
        return <LifestyleStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "eating_behavior":
        return <EatingBehaviorStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "challenges":
        return <ChallengesStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "goals":
        return <GoalsStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "preferences":
        return <PreferencesStep data={data} updateData={updateData} t={t} />;
      case "female":
        return <FemaleStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} t={t} />;
      case "measurements":
        return (
          <MeasurementsStep 
            data={{
              bodyFatPercentage: data.bodyFatPercentage,
              waist: data.waist,
              hip: data.hip,
              chest: data.chest,
              arm: data.arm,
              thigh: data.thigh,
              neck: data.neck,
              hasProgressPhoto: data.hasProgressPhoto,
              progressPhotoUrl: data.progressPhotoUrl,
              progressPhotos: data.progressPhotos || {
                front: data.progressPhotoUrl || null,
                back: null,
                left: null,
                right: null,
              },
            }}
            updateData={(key, value) => updateData(key as keyof OnboardingData, value as never)}
            unitSystem={data.unitSystem}
            t={t}
            isOnboarding={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with Logo */}
      <div className="p-4 flex flex-col items-center safe-pt-4">
        <img src={macLogo} alt="MAC Nutrition" className="h-12 sm:h-14 mb-3" style={{ mixBlendMode: 'multiply' }} />
        
        {/* Progress bar */}
        <div className="w-full max-w-md">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-hero transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {allSteps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex flex-col items-center transition-colors ${
                  index <= currentStepIndex ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold ${
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl gradient-hero flex items-center justify-center text-primary-foreground">
              {currentStep.icon}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{currentStep.title}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('step_x_of_y').replace('{current}', String(currentStepIndex + 1)).replace('{total}', String(allSteps.length))}
              </p>
            </div>
          </div>
          
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation - always visible at bottom */}
      <div className="sticky bottom-0 p-4 sm:p-6 flex gap-3 border-t border-border bg-background safe-pb-4">
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

// ==================== STEP COMPONENTS ====================

const DemographicsStep = ({ data, updateData, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  t: (key: string) => string;
}) => (
  <div className="space-y-6 animate-slide-up">
    {/* Unit System Toggle */}
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{t('measurement_system')}</Label>
      <p className="text-xs text-muted-foreground mb-2">This will be used throughout the app</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('metric'), desc: t('cm_kg'), value: "metric" as const },
          { label: t('imperial'), desc: t('ft_in_lbs'), value: "imperial" as const },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => updateData("unitSystem", option.value)}
            className={`p-4 rounded-xl text-center transition-all ${
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

const LifestyleStep = ({ data, updateData, toggleArrayItem, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const activityLevels = [
    { label: t('not_active'), desc: t('not_active_desc'), value: "not_active" },
    { label: t('semi_active'), desc: t('semi_active_desc'), value: "semi_active" },
    { label: t('active'), desc: t('active_desc'), value: "active" },
    { label: t('very_active'), desc: t('very_active_desc'), value: "very_active" },
  ];

  const jobActivityLevels = [
    { label: "Sedentary", desc: "Desk job, mostly sitting", value: "sedentary", icon: "🖥️" },
    { label: "Lightly Active", desc: "Some walking, standing occasionally", value: "light", icon: "🚶" },
    { label: "Moderately Active", desc: "On feet most of the day", value: "moderate", icon: "🏃" },
    { label: "Very Active", desc: "Physical labor, constant movement", value: "active", icon: "💪" },
  ];

  const workoutTypeOptions = [
    { key: "weightlifting", label: "Weightlifting", icon: "🏋️" },
    { key: "cardio", label: "Cardio/Running", icon: "🏃" },
    { key: "crossfit", label: "CrossFit", icon: "⚡" },
    { key: "yoga", label: "Yoga/Pilates", icon: "🧘" },
    { key: "hiit", label: "HIIT", icon: "🔥" },
    { key: "swimming", label: "Swimming", icon: "🏊" },
    { key: "cycling", label: "Cycling", icon: "🚴" },
    { key: "sports", label: "Team Sports", icon: "⚽" },
    { key: "martial_arts", label: "Martial Arts", icon: "🥋" },
    { key: "dance", label: "Dance", icon: "💃" },
    { key: "walking", label: "Walking Only", icon: "🚶" },
    { key: "none", label: "None Currently", icon: "❌" },
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
      {/* Job Activity Level - NEW */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">How active is your job?</Label>
        <div className="space-y-2">
          {jobActivityLevels.map((level) => (
            <button
              key={level.value}
              onClick={() => updateData("jobActivityLevel", level.value)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                data.jobActivityLevel === level.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-xl">{level.icon}</span>
              <div>
                <span className="font-semibold block">{level.label}</span>
                <span className={`text-sm ${data.jobActivityLevel === level.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {level.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Overall Activity Level */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{t('daily_activity_level')}</Label>
        <p className="text-xs text-muted-foreground -mt-1">Including work + leisure</p>
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

      {/* Training Days */}
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

      {/* Workout Types - NEW */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">What type of workouts do you do?</Label>
        <p className="text-xs text-muted-foreground -mt-1">Select all that apply</p>
        <div className="grid grid-cols-2 gap-2">
          {workoutTypeOptions.map((workout) => (
            <button
              key={workout.key}
              onClick={() => toggleArrayItem("workoutTypes", workout.key)}
              className={`p-3 rounded-xl text-left transition-all flex items-center gap-2 ${
                data.workoutTypes.includes(workout.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg">{workout.icon}</span>
              <span className="text-sm font-medium">{workout.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sleep Hours */}
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

      {/* Stress Level */}
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

// NEW: Eating Behavior Step
const EatingBehaviorStep = ({ data, updateData, toggleArrayItem, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const eatingSpeedOptions = [
    { label: "Fast", desc: "I finish meals quickly, often first at the table", value: "fast", icon: "⚡" },
    { label: "Moderate", desc: "I eat at a normal pace", value: "moderate", icon: "⏱️" },
    { label: "Slow", desc: "I take my time, often last to finish", value: "slow", icon: "🐢" },
  ];

  const hungerPatterns = [
    { label: "Morning person", desc: "Hungry right when I wake up", value: "morning", icon: "🌅" },
    { label: "Late starter", desc: "Not hungry until late morning/noon", value: "late_starter", icon: "☕" },
    { label: "Evening eater", desc: "Appetite peaks in the evening", value: "evening", icon: "🌙" },
    { label: "Grazer", desc: "Small hunger throughout the day", value: "grazer", icon: "🥗" },
  ];

  const cravingsTriggers = [
    { key: "stress", label: "Stress/Anxiety" },
    { key: "boredom", label: "Boredom" },
    { key: "tiredness", label: "Tiredness" },
    { key: "social", label: "Social situations" },
    { key: "emotions", label: "Strong emotions" },
    { key: "visual_cues", label: "Seeing food/ads" },
    { key: "none", label: "Rarely have cravings" },
  ];

  const emotionalEatingOptions = [
    { label: "Rarely", desc: "I mostly eat when physically hungry", value: "rarely" },
    { label: "Sometimes", desc: "Occasionally eat for comfort", value: "sometimes" },
    { label: "Often", desc: "Frequently eat based on emotions", value: "often" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
        <Brain className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Understanding your eating patterns helps us personalize recommendations that work with your natural habits.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How fast do you typically eat?</Label>
        <div className="space-y-2">
          {eatingSpeedOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("eatingSpeed", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                data.eatingSpeed === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-2xl">{option.icon}</span>
              <div>
                <span className="font-semibold block">{option.label}</span>
                <span className={`text-sm ${data.eatingSpeed === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {option.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">When are you most hungry?</Label>
        <div className="grid grid-cols-2 gap-2">
          {hungerPatterns.map((pattern) => (
            <button
              key={pattern.value}
              onClick={() => updateData("hungerPatterns", pattern.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.hungerPatterns === pattern.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg block mb-1">{pattern.icon}</span>
              <span className="font-semibold block text-sm">{pattern.label}</span>
              <span className={`text-xs ${data.hungerPatterns === pattern.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {pattern.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">What triggers your cravings? (Select all)</Label>
        <div className="grid grid-cols-2 gap-2">
          {cravingsTriggers.map((trigger) => (
            <button
              key={trigger.key}
              onClick={() => toggleArrayItem("cravingsTriggers", trigger.key)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.cravingsTriggers.includes(trigger.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {trigger.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How often do you eat for emotional reasons?</Label>
        <div className="space-y-2">
          {emotionalEatingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("emotionalEating", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.emotionalEating === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{option.label}</span>
              <span className={`text-sm ${data.emotionalEating === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// NEW: Challenges & History Step
const ChallengesStep = ({ data, updateData, toggleArrayItem, t }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
  t: (key: string) => string;
}) => {
  const challenges = [
    { label: "Consistency", desc: "Sticking to plans long-term", value: "consistency", icon: "📅" },
    { label: "Portion control", desc: "Knowing when to stop eating", value: "portion_control", icon: "🍽️" },
    { label: "Cravings", desc: "Managing hunger and cravings", value: "cravings", icon: "🍫" },
    { label: "Time", desc: "Finding time to prep healthy meals", value: "time", icon: "⏰" },
    { label: "Social eating", desc: "Making good choices around others", value: "social", icon: "👥" },
    { label: "Knowledge", desc: "Not sure what/how much to eat", value: "knowledge", icon: "📚" },
  ];

  const pastDiets = [
    { key: "calorie_counting", label: "Calorie counting" },
    { key: "keto", label: "Keto/Low carb" },
    { key: "intermittent_fasting", label: "Intermittent fasting" },
    { key: "weight_watchers", label: "Weight Watchers" },
    { key: "paleo", label: "Paleo" },
    { key: "macro_tracking", label: "Macro tracking" },
    { key: "none", label: "None/First time" },
  ];

  const weekendHabits = [
    { label: "Same as weekdays", desc: "I keep similar habits", value: "same" },
    { label: "More relaxed", desc: "I allow more flexibility", value: "relaxed" },
    { label: "Completely different", desc: "Weekends are off the rails", value: "different" },
  ];

  const prepTimeOptions = [
    { label: "< 15 min", desc: "Quick and simple meals", value: "quick", icon: "⚡" },
    { label: "15-30 min", desc: "Moderate prep time", value: "moderate", icon: "👍" },
    { label: "30-60 min", desc: "Enjoy cooking", value: "enjoy", icon: "👨‍🍳" },
    { label: "Meal prep", desc: "Batch cook on weekends", value: "batch", icon: "📦" },
  ];

  const cookingSkillOptions = [
    { label: "Beginner", value: "beginner" },
    { label: "Intermediate", value: "intermediate" },
    { label: "Advanced", value: "advanced" },
  ];

  const eatingOutOptions = [
    { label: "Rarely", desc: "1-2x/month", value: "rarely" },
    { label: "Weekly", desc: "1-2x/week", value: "weekly" },
    { label: "Often", desc: "3-5x/week", value: "often" },
    { label: "Daily", desc: "Most meals out", value: "daily" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">What's your biggest nutrition challenge?</Label>
        <div className="space-y-2">
          {challenges.map((challenge) => (
            <button
              key={challenge.value}
              onClick={() => updateData("biggestChallenge", challenge.value)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                data.biggestChallenge === challenge.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-2xl">{challenge.icon}</span>
              <div>
                <span className="font-semibold block">{challenge.label}</span>
                <span className={`text-sm ${data.biggestChallenge === challenge.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {challenge.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">What diets have you tried before? (Select all)</Label>
        <div className="grid grid-cols-2 gap-2">
          {pastDiets.map((diet) => (
            <button
              key={diet.key}
              onClick={() => toggleArrayItem("pastDiets", diet.key)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.pastDiets.includes(diet.key)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {diet.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How much time can you spend on meal prep?</Label>
        <div className="grid grid-cols-2 gap-2">
          {prepTimeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("mealPrepTime", option.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.mealPrepTime === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg block mb-1">{option.icon}</span>
              <span className="font-semibold block text-sm">{option.label}</span>
              <span className={`text-xs ${data.mealPrepTime === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Cooking skill level</Label>
        <div className="grid grid-cols-3 gap-2">
          {cookingSkillOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("cookingSkill", option.value)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.cookingSkill === option.value
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
        <Label className="text-sm font-semibold">How often do you eat out or order in?</Label>
        <div className="grid grid-cols-2 gap-2">
          {eatingOutOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("eatingOutFrequency", option.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.eatingOutFrequency === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block text-sm">{option.label}</span>
              <span className={`text-xs ${data.eatingOutFrequency === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How are your weekends compared to weekdays?</Label>
        <div className="space-y-2">
          {weekendHabits.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("weekendHabits", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.weekendHabits === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{option.label}</span>
              <span className={`text-sm ${data.weekendHabits === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
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

  const motivationStyles = [
    { label: "Data-driven", desc: "I love tracking numbers and progress", value: "data_driven", icon: "📊" },
    { label: "Habit-focused", desc: "I prefer building consistent routines", value: "habit_focused", icon: "🔄" },
    { label: "Results-oriented", desc: "Show me the outcome, not the details", value: "results_oriented", icon: "🎯" },
    { label: "Education-first", desc: "I want to understand why", value: "education_first", icon: "📚" },
  ];

  const accountabilityOptions = [
    { label: "Self-motivated", desc: "I work best independently", value: "self" },
    { label: "Daily check-ins", desc: "Regular reminders help me stay on track", value: "daily_checkins" },
    { label: "Gentle nudges", desc: "Occasional reminders without pressure", value: "gentle" },
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

      <div className="space-y-3">
        <Label className="text-sm font-semibold">What motivates you most?</Label>
        <div className="grid grid-cols-2 gap-2">
          {motivationStyles.map((style) => (
            <button
              key={style.value}
              onClick={() => updateData("motivationStyle", style.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.motivationStyle === style.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg block mb-1">{style.icon}</span>
              <span className="font-semibold block text-sm">{style.label}</span>
              <span className={`text-xs ${data.motivationStyle === style.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {style.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">What type of accountability works for you?</Label>
        <div className="space-y-2">
          {accountabilityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("accountabilityPreference", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.accountabilityPreference === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{option.label}</span>
              <span className={`text-sm ${data.accountabilityPreference === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
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

  const proteinShakeOptions = [
    { label: "Love them", desc: "Happy to have shakes daily", value: "love", icon: "🥤" },
    { label: "Sometimes", desc: "Occasionally for convenience", value: "sometimes", icon: "👍" },
    { label: "Prefer whole foods", desc: "Only real food for me", value: "prefer_whole_foods", icon: "🍗" },
    { label: "Never", desc: "I don't use protein shakes", value: "never", icon: "🚫" },
  ];

  const snackingOptions = [
    { label: "Never", desc: "I don't snack between meals", value: "never" },
    { label: "Sometimes", desc: "1-2 snacks when hungry", value: "sometimes" },
    { label: "Often", desc: "Regular snacker throughout day", value: "often" },
  ];

  const hydrationOptions = [
    { label: "Forget often", desc: "I rarely drink enough water", value: "poor" },
    { label: "Moderate", desc: "I drink when I remember", value: "moderate" },
    { label: "Good", desc: "I stay well hydrated", value: "good" },
  ];

  const energyPatternOptions = [
    { label: "Morning bird", desc: "Most productive in AM", value: "morning", icon: "🌅" },
    { label: "Steady", desc: "Consistent throughout day", value: "steady", icon: "➡️" },
    { label: "Afternoon peak", desc: "Hit my stride after lunch", value: "afternoon", icon: "☀️" },
    { label: "Night owl", desc: "Most energized at night", value: "night", icon: "🦉" },
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
        <Label className="text-sm font-semibold">How do you feel about protein shakes?</Label>
        <div className="grid grid-cols-2 gap-2">
          {proteinShakeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("proteinShakesPreference", option.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.proteinShakesPreference === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg block mb-1">{option.icon}</span>
              <span className="font-semibold block text-sm">{option.label}</span>
              <span className={`text-xs ${data.proteinShakesPreference === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How do you typically snack?</Label>
        <div className="space-y-2">
          {snackingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("snackingHabits", option.value)}
              className={`w-full p-4 rounded-xl text-left transition-all ${
                data.snackingHabits === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block">{option.label}</span>
              <span className={`text-sm ${data.snackingHabits === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">How's your water intake?</Label>
        <div className="grid grid-cols-3 gap-2">
          {hydrationOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("hydrationHabits", option.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.hydrationHabits === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="font-semibold block text-sm">{option.label}</span>
              <span className={`text-xs ${data.hydrationHabits === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">When's your peak energy time?</Label>
        <div className="grid grid-cols-2 gap-2">
          {energyPatternOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateData("energyPatterns", option.value)}
              className={`p-3 rounded-xl text-left transition-all ${
                data.energyPatterns === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              <span className="text-lg block mb-1">{option.icon}</span>
              <span className="font-semibold block text-sm">{option.label}</span>
              <span className={`text-xs ${data.energyPatterns === option.value ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {option.desc}
              </span>
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
