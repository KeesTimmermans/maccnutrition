ALTER TABLE public.user_baselines
  ADD COLUMN IF NOT EXISTS left_arm numeric,
  ADD COLUMN IF NOT EXISTS right_arm numeric,
  ADD COLUMN IF NOT EXISTS clothing_size text;