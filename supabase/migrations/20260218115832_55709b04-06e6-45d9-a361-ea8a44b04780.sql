-- Add analytics_consent column to user_baselines
ALTER TABLE public.user_baselines
  ADD COLUMN IF NOT EXISTS analytics_consent boolean NOT NULL DEFAULT false;
