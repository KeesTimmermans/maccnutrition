ALTER TABLE public.workouts
  ADD COLUMN workout_format text NOT NULL DEFAULT 'standard',
  ADD COLUMN format_details jsonb;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_workout_format_check
  CHECK (workout_format IN ('standard', 'emom', 'for_time', 'amrap'));