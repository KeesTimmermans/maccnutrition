import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Sparkles, Target, Activity, Moon, Utensils } from "lucide-react";

interface Question {
  id: number;
  question: string;
  icon: React.ReactNode;
  options: { label: string; value: string }[];
}

const questions: Question[] = [
  {
    id: 1,
    question: "What's your primary health goal?",
    icon: <Target className="w-8 h-8" />,
    options: [
      { label: "Lose weight", value: "lose_weight" },
      { label: "Build muscle", value: "build_muscle" },
      { label: "Maintain health", value: "maintain" },
      { label: "Increase energy", value: "energy" },
    ],
  },
  {
    id: 2,
    question: "How active are you on a typical day?",
    icon: <Activity className="w-8 h-8" />,
    options: [
      { label: "Sedentary (desk job)", value: "sedentary" },
      { label: "Lightly active", value: "light" },
      { label: "Moderately active", value: "moderate" },
      { label: "Very active", value: "very_active" },
    ],
  },
  {
    id: 3,
    question: "How would you describe your sleep quality?",
    icon: <Moon className="w-8 h-8" />,
    options: [
      { label: "Poor (< 5 hours)", value: "poor" },
      { label: "Fair (5-6 hours)", value: "fair" },
      { label: "Good (7-8 hours)", value: "good" },
      { label: "Excellent (8+ hours)", value: "excellent" },
    ],
  },
  {
    id: 4,
    question: "How many meals do you typically eat per day?",
    icon: <Utensils className="w-8 h-8" />,
    options: [
      { label: "1-2 meals", value: "1-2" },
      { label: "3 meals", value: "3" },
      { label: "4-5 meals", value: "4-5" },
      { label: "Grazing/snacking", value: "grazing" },
    ],
  },
  {
    id: 5,
    question: "Any dietary preferences or restrictions?",
    icon: <Sparkles className="w-8 h-8" />,
    options: [
      { label: "No restrictions", value: "none" },
      { label: "Vegetarian/Vegan", value: "vegetarian" },
      { label: "Gluten-free", value: "gluten_free" },
      { label: "Other allergies", value: "other" },
    ],
  },
];

interface OnboardingQuestionnaireProps {
  onComplete: (answers: Record<number, string>) => void;
}

export const OnboardingQuestionnaire = ({ onComplete }: OnboardingQuestionnaireProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  const handleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      onComplete(answers);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="p-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full gradient-hero transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Question {currentQuestion + 1} of {questions.length}
        </p>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-20 h-20 rounded-3xl gradient-hero flex items-center justify-center mb-6 text-primary-foreground animate-float">
          {question.icon}
        </div>
        
        <h2 className="text-2xl font-bold text-foreground text-center mb-8 animate-slide-up">
          {question.question}
        </h2>

        {/* Options */}
        <div className="w-full max-w-md space-y-3">
          {question.options.map((option, index) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full p-4 rounded-2xl text-left transition-all duration-200 animate-slide-up ${
                answers[question.id] === option.value
                  ? "bg-primary text-primary-foreground shadow-medium"
                  : "bg-card shadow-soft hover:shadow-medium hover:scale-[1.02]"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <span className="font-semibold">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 flex gap-3">
        {currentQuestion > 0 && (
          <Button
            variant="soft"
            size="lg"
            onClick={handleBack}
            className="flex-1"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </Button>
        )}
        <Button
          variant="hero"
          size="lg"
          onClick={handleNext}
          disabled={!answers[question.id]}
          className="flex-1"
        >
          {currentQuestion === questions.length - 1 ? (
            <>
              Get Started
              <Sparkles className="w-5 h-5 ml-1" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
