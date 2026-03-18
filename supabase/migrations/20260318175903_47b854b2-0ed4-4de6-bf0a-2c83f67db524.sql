
ALTER TABLE public.meals ADD COLUMN IF NOT EXISTS sugar integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_baselines ADD COLUMN IF NOT EXISTS sugar_grams integer NULL;
