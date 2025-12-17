-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_baselines table to store onboarding data and calculated baselines
CREATE TABLE public.user_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Demographics
  age INTEGER,
  sex TEXT,
  unit_system TEXT DEFAULT 'imperial',
  height_feet INTEGER,
  height_inches INTEGER,
  height_cm NUMERIC,
  weight NUMERIC,
  
  -- Medical & Allergies
  conditions TEXT[],
  allergies TEXT[],
  
  -- Lifestyle
  occupation TEXT,
  work_hours TEXT,
  training_days TEXT,
  training_intensity TEXT,
  sleep_hours TEXT,
  activity_level TEXT,
  stress_level TEXT,
  
  -- Goals
  primary_goal TEXT,
  secondary_goals TEXT[],
  
  -- Preferences
  diet_type TEXT,
  food_dislikes TEXT,
  coaching_tone TEXT,
  meals_per_day TEXT,
  
  -- Female-Specific
  cycle_regularity TEXT,
  current_phase TEXT,
  cycle_symptoms TEXT[],
  
  -- Calculated Baseline Values
  tdee INTEGER,
  target_calories INTEGER,
  protein_grams INTEGER,
  carbs_grams INTEGER,
  fats_grams INTEGER,
  water_liters NUMERIC,
  sodium_mg INTEGER,
  magnesium_mg INTEGER,
  potassium_mg INTEGER,
  focus_points TEXT[],
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_baselines ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for user_baselines
CREATE POLICY "Users can view their own baseline"
  ON public.user_baselines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own baseline"
  ON public.user_baselines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own baseline"
  ON public.user_baselines FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_baselines_updated_at
  BEFORE UPDATE ON public.user_baselines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();