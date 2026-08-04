ALTER TABLE public.user_baselines
ADD COLUMN household_size integer NOT NULL DEFAULT 1;

ALTER TABLE public.user_baselines
ADD CONSTRAINT user_baselines_household_size_check
CHECK (household_size >= 1 AND household_size <= 20);