-- Create daily check-ins table
CREATE TABLE public.daily_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
  sleep_hours DECIMAL(3,1),
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
  hydration_feeling INTEGER CHECK (hydration_feeling >= 1 AND hydration_feeling <= 5),
  hunger_level INTEGER CHECK (hunger_level >= 1 AND hunger_level <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_in_date)
);

-- Enable RLS
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own check-ins"
ON public.daily_checkins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-ins"
ON public.daily_checkins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
ON public.daily_checkins
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_daily_checkins_updated_at
BEFORE UPDATE ON public.daily_checkins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_daily_checkins_user_date ON public.daily_checkins(user_id, check_in_date DESC);