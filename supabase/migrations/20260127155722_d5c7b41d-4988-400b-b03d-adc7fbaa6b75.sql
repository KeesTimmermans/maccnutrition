-- Persist daily focus points + coach narrative per check-in
ALTER TABLE public.daily_checkins
ADD COLUMN IF NOT EXISTS coach_response TEXT;

ALTER TABLE public.daily_checkins
ADD COLUMN IF NOT EXISTS daily_focus_points JSONB;