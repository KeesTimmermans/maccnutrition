-- Add consent fields to user_baselines
ALTER TABLE public.user_baselines
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS health_data_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;
