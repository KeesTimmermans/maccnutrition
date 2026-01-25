-- Create table for progress update history
CREATE TABLE public.progress_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- User's choice and feedback
  satisfaction_choice TEXT NOT NULL, -- 'happy', 'more_progress', 'update_measurements'
  user_feedback TEXT,
  
  -- Coach response
  coach_response TEXT,
  
  -- Snapshot of adjustments made (if any)
  adjustments JSONB, -- { calorie_change: -150, protein_change: 20, reason: "..." }
  
  -- Snapshot of targets at time of check-in
  target_calories INTEGER,
  protein_grams INTEGER,
  carbs_grams INTEGER,
  fats_grams INTEGER,
  
  -- Snapshot of measurements at time of check-in
  weight NUMERIC,
  body_fat_percentage NUMERIC,
  waist_cm NUMERIC,
  hip_cm NUMERIC,
  chest_cm NUMERIC,
  arm_cm NUMERIC,
  thigh_cm NUMERIC,
  neck_cm NUMERIC
);

-- Enable Row Level Security
ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own progress updates"
ON public.progress_updates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress updates"
ON public.progress_updates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_progress_updates_user_date ON public.progress_updates (user_id, created_at DESC);