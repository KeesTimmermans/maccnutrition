ALTER TABLE public.user_baselines
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'calories';

ALTER TABLE public.user_baselines
  ADD CONSTRAINT user_baselines_tracking_mode_check CHECK (tracking_mode IN ('calories', 'habits'));