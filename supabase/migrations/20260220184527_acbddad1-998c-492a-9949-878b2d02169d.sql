
-- Add cycle_phase_today to daily_checkins
ALTER TABLE public.daily_checkins ADD COLUMN IF NOT EXISTS cycle_phase_today text;

-- Add cycle_phase_updated_at to user_baselines
ALTER TABLE public.user_baselines ADD COLUMN IF NOT EXISTS cycle_phase_updated_at timestamptz;
