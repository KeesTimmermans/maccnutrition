-- Add protein shakes preference column to user_baselines
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS protein_shakes_preference TEXT DEFAULT NULL;