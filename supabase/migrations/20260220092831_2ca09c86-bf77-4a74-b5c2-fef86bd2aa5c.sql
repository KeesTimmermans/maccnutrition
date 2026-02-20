
ALTER TABLE public.user_baselines ADD COLUMN IF NOT EXISTS water_liters_training numeric DEFAULT NULL;
COMMENT ON COLUMN public.user_baselines.water_liters_training IS 'Training day hydration target in liters (rest day target stored in water_liters)';
