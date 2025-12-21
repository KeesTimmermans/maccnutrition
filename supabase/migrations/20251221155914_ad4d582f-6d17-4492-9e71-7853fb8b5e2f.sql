-- Add preferred_language column to user_baselines table
ALTER TABLE public.user_baselines 
ADD COLUMN preferred_language TEXT DEFAULT 'en';

-- Add a comment for documentation
COMMENT ON COLUMN public.user_baselines.preferred_language IS 'User preferred language: en, fr, es, it, pt';