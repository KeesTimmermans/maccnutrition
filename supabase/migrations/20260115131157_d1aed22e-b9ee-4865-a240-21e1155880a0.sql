-- Add new columns for expanded onboarding questionnaire
ALTER TABLE public.user_baselines
  ADD COLUMN IF NOT EXISTS eating_speed text,
  ADD COLUMN IF NOT EXISTS hunger_patterns text,
  ADD COLUMN IF NOT EXISTS cravings_triggers text[],
  ADD COLUMN IF NOT EXISTS emotional_eating text,
  ADD COLUMN IF NOT EXISTS biggest_challenge text,
  ADD COLUMN IF NOT EXISTS past_diets text[],
  ADD COLUMN IF NOT EXISTS motivation_style text,
  ADD COLUMN IF NOT EXISTS accountability_preference text,
  ADD COLUMN IF NOT EXISTS meal_prep_time text,
  ADD COLUMN IF NOT EXISTS cooking_skill text,
  ADD COLUMN IF NOT EXISTS eating_out_frequency text,
  ADD COLUMN IF NOT EXISTS snacking_habits text,
  ADD COLUMN IF NOT EXISTS hydration_habits text,
  ADD COLUMN IF NOT EXISTS energy_patterns text,
  ADD COLUMN IF NOT EXISTS weekend_habits text;