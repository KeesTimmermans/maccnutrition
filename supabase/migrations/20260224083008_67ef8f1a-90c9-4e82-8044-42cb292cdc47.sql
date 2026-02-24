
-- Add onboarding_completed flag to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

-- Backfill: mark users who already have a user_baselines row as onboarding_completed
UPDATE public.profiles
SET onboarding_completed = true,
    onboarding_completed_at = ub.created_at
FROM public.user_baselines ub
WHERE profiles.user_id = ub.user_id;
