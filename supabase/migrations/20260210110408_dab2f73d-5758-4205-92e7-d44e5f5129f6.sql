
-- Update default timezone from America/New_York to Europe/London
ALTER TABLE public.user_baselines 
  ALTER COLUMN reminder_timezone SET DEFAULT 'Europe/London';

-- Update default unit_system from imperial to metric
ALTER TABLE public.user_baselines 
  ALTER COLUMN unit_system SET DEFAULT 'metric';

-- Update default currency from USD to GBP
ALTER TABLE public.user_baselines 
  ALTER COLUMN preferred_currency SET DEFAULT 'GBP';

-- Migrate existing users who never explicitly chose a timezone (still on old default)
UPDATE public.user_baselines 
  SET reminder_timezone = 'Europe/London' 
  WHERE reminder_timezone = 'America/New_York';

-- Migrate existing users who never explicitly chose a currency (still on old default)  
UPDATE public.user_baselines 
  SET preferred_currency = 'GBP' 
  WHERE preferred_currency = 'USD';

-- Migrate existing users who never explicitly chose units (still on old default)
UPDATE public.user_baselines 
  SET unit_system = 'metric' 
  WHERE unit_system = 'imperial';
