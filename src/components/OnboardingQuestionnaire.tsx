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

type StepType = "demographics" | "medical" | "lifestyle" | "goals" | "preferences" | "female";

interface OnboardingData {
  // Demographics
  age: string;
  sex: "male" | "female" | "";
  heightFeet: string;
  heightInches: string;
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
  heightFeet: "",
  heightInches: "",
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

const steps: { id: StepType; title: string; icon: React.ReactNode }[] = [
  { id: "demographics", title: "About You", icon: <User className="w-6 h-6" /> },
  { id: "medical", title: "Health Info", icon: <Heart className="w-6 h-6" /> },
  { id: "lifestyle", title: "Lifestyle", icon: <Activity className="w-6 h-6" /> },
  { id: "goals", title: "Your Goals", icon: <Target className="w-6 h-6" /> },
  { id: "preferences", title: "Preferences", icon: <Utensils className="w-6 h-6" /> },
];

interface OnboardingQuestionnaireProps {
  onComplete: (data: OnboardingData) => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);
  
  const allSteps = data.sex === "female" 
    ? [...steps, { id: "female" as StepType, title: "Cycle Info", icon: <Moon className="w-6 h-6" /> }]
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
        return data.age && data.sex && data.heightFeet && data.weight;
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
        return <DemographicsStep data={data} updateData={updateData} />;
      case "medical":
        return <MedicalStep data={data} toggleArrayItem={toggleArrayItem} />;
      case "lifestyle":
        return <LifestyleStep data={data} updateData={updateData} />;
      case "goals":
        return <GoalsStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} />;
      case "preferences":
        return <PreferencesStep data={data} updateData={updateData} />;
      case "female":
        return <FemaleStep data={data} updateData={updateData} toggleArrayItem={toggleArrayItem} />;
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
                Step {currentStepIndex + 1} of {allSteps.length}
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
            Back
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
              Complete Setup
              <Sparkles className="w-5 h-5 ml-1" />
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Step Components
const DemographicsStep = ({ data, updateData }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}) => (
  <div className="space-y-6 animate-slide-up">
    <div className="space-y-2">
      <Label className="text-sm font-semibold">Age</Label>
      <Input
        type="number"
        placeholder="Enter your age"
        value={data.age}
        onChange={(e) => updateData("age", e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">Biological Sex</Label>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Male", value: "male" },
          { label: "Female", value: "female" },
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
      <Label className="text-sm font-semibold">Height</Label>
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Feet"
            value={data.heightFeet}
            onChange={(e) => updateData("heightFeet", e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Inches"
            value={data.heightInches}
            onChange={(e) => updateData("heightInches", e.target.value)}
            className="h-12 rounded-xl"
          />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <Label className="text-sm font-semibold">Current Weight (lbs)</Label>
      <Input
        type="number"
        placeholder="Enter your weight"
        value={data.weight}
        onChange={(e) => updateData("weight", e.target.value)}
        className="h-12 rounded-xl"
      />
    </div>
  </div>
);

const MedicalStep = ({ data, toggleArrayItem }: { 
  data: OnboardingData; 
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
}) => {
  const conditions = [
    "Diabetes", "PCOS", "IBS", "Thyroid issues", "High blood pressure", 
    "Heart condition", "Kidney issues", "None"
  ];
  
  const allergies = [
    "Dairy", "Gluten", "Nuts", "Shellfish", "Eggs", "Soy", "None"
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          This information helps us provide better recommendations. All data is kept confidential.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Any health conditions? (Select all that apply)</Label>
        <div className="grid grid-cols-2 gap-2">
          {conditions.map((condition) => (
            <button
              key={condition}
              onClick={() => toggleArrayItem("conditions", condition)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.conditions.includes(condition)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {condition}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Food allergies or intolerances?</Label>
        <div className="grid grid-cols-2 gap-2">
          {allergies.map((allergy) => (
            <button
              key={allergy}
              onClick={() => toggleArrayItem("allergies", allergy)}
              className={`p-3 rounded-xl text-sm text-left transition-all ${
                data.allergies.includes(allergy)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {allergy}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const LifestyleStep = ({ data, updateData }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}) => {
  const activityLevels = [
    { label: "Not active", desc: "Desk job, minimal movement", value: "not_active" },
    { label: "Semi-active", desc: "Some walking, light activity", value: "semi_active" },
    { label: "Active", desc: "Regular exercise, on feet often", value: "active" },
    { label: "Very active", desc: "Intense training, physical job", value: "very_active" },
  ];

  const trainingOptions = [
    { label: "0-1 days", value: "0-1" },
    { label: "2-3 days", value: "2-3" },
    { label: "4-5 days", value: "4-5" },
    { label: "6+ days", value: "6+" },
  ];

  const sleepOptions = [
    { label: "Less than 5 hrs", value: "<5" },
    { label: "5-6 hours", value: "5-6" },
    { label: "7-8 hours", value: "7-8" },
    { label: "8+ hours", value: "8+" },
  ];

  const stressLevels = [
    { label: "Low", value: "low" },
    { label: "Moderate", value: "moderate" },
    { label: "High", value: "high" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Daily activity level</Label>
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
        <Label className="text-sm font-semibold">Training days per week</Label>
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
        <Label className="text-sm font-semibold">Average sleep per night</Label>
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
        <Label className="text-sm font-semibold">Current stress level</Label>
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

const GoalsStep = ({ data, updateData, toggleArrayItem }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
}) => {
  const primaryGoals = [
    { label: "Fat Loss", desc: "Reduce body fat while preserving muscle", value: "fat_loss", icon: "🔥" },
    { label: "Muscle Gain", desc: "Build lean muscle mass", value: "muscle_gain", icon: "💪" },
    { label: "Performance", desc: "Optimize athletic performance", value: "performance", icon: "⚡" },
    { label: "General Health", desc: "Maintain health and wellbeing", value: "general_health", icon: "🌿" },
  ];

  const secondaryGoals = [
    "Better energy", "Improved recovery", "Better sleep", 
    "Reduce inflammation", "Hormone balance", "Mental clarity"
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Primary goal</Label>
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
        <Label className="text-sm font-semibold">Secondary goals (optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          {secondaryGoals.map((goal) => (
            <button
              key={goal}
              onClick={() => toggleArrayItem("secondaryGoals", goal)}
              className={`p-3 rounded-xl text-sm text-center transition-all ${
                data.secondaryGoals.includes(goal)
                  ? "bg-primary text-primary-foreground"
                  : "bg-card shadow-soft hover:shadow-medium"
              }`}
            >
              {goal}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const PreferencesStep = ({ data, updateData }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}) => {
  const dietTypes = [
    { label: "Omnivore", desc: "Eats everything", value: "omnivore" },
    { label: "Pescatarian", desc: "Fish but no meat", value: "pescatarian" },
    { label: "Vegetarian", desc: "No meat or fish", value: "vegetarian" },
    { label: "Vegan", desc: "No animal products", value: "vegan" },
  ];

  const coachingTones = [
    { label: "Supportive", desc: "Encouraging and gentle", value: "supportive" },
    { label: "Direct", desc: "Straight to the point", value: "direct" },
    { label: "Motivating", desc: "Energetic and pushing", value: "motivating" },
  ];

  const mealOptions = [
    { label: "2 meals", value: "2" },
    { label: "3 meals", value: "3" },
    { label: "4+ meals", value: "4+" },
    { label: "Flexible", value: "flexible" },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Diet type</Label>
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
        <Label className="text-sm font-semibold">Preferred meals per day</Label>
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
        <Label className="text-sm font-semibold">Coaching tone preference</Label>
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
        <Label className="text-sm font-semibold">Foods you dislike (optional)</Label>
        <Input
          placeholder="e.g., mushrooms, olives, tofu"
          value={data.foodDislikes}
          onChange={(e) => updateData("foodDislikes", e.target.value)}
          className="h-12 rounded-xl"
        />
      </div>
    </div>
  );
};

const FemaleStep = ({ data, updateData, toggleArrayItem }: { 
  data: OnboardingData; 
  updateData: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  toggleArrayItem: (key: keyof OnboardingData, item: string) => void;
}) => {
  const regularityOptions = [
    { label: "Regular", desc: "Consistent cycle length", value: "regular" },
    { label: "Irregular", desc: "Varies significantly", value: "irregular" },
    { label: "Not tracking", desc: "Prefer not to say", value: "not_tracking" },
  ];

  const phaseOptions = [
    { label: "Menstrual", desc: "Days 1-5", value: "menstrual" },
    { label: "Follicular", desc: "Days 6-14", value: "follicular" },
    { label: "Ovulation", desc: "Around day 14", value: "ovulation" },
    { label: "Luteal", desc: "Days 15-28", value: "luteal" },
    { label: "Unsure", desc: "Not tracking", value: "unsure" },
  ];

  const symptoms = [
    "Cravings", "Fatigue", "Bloating", "Mood changes", 
    "Low energy", "Sleep issues", "None/minimal"
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="bg-accent/50 rounded-xl p-4 flex gap-3">
        <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          Cycle information helps us adjust your nutrition recommendations for better energy and recovery throughout the month.
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Cycle regularity</Label>
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
            <Label className="text-sm font-semibold">Current phase (approximate)</Label>
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
            <Label className="text-sm font-semibold">Common symptoms</Label>
            <div className="grid grid-cols-2 gap-2">
              {symptoms.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleArrayItem("cycleSymptoms", symptom)}
                  className={`p-3 rounded-xl text-sm text-center transition-all ${
                    data.cycleSymptoms.includes(symptom)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card shadow-soft hover:shadow-medium"
                  }`}
                >
                  {symptom}
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
