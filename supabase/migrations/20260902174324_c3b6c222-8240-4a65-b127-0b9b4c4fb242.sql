ALTER TABLE public.workouts ADD COLUMN format_block jsonb;

COMMENT ON COLUMN public.workouts.format_block IS 'Optional EMOM / For Time / AMRAP block result stored as JSON';
