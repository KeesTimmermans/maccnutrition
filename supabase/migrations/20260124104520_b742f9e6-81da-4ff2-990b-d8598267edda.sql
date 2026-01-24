-- Add currency preference column to user_baselines
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD';

-- Add a comment for clarity
COMMENT ON COLUMN public.user_baselines.preferred_currency IS 'User preferred currency for grocery list estimates (USD, GBP, EUR, etc.)';