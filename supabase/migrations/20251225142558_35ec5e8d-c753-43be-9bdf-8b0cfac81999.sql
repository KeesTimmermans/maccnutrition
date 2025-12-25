-- Add name column to user_baselines table
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS name text;