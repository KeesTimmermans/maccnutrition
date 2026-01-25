-- Add column to track last progress update
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS last_progress_update timestamp with time zone;