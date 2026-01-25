-- Add column to store personalized coaching focus points from progress updates
ALTER TABLE public.progress_updates 
ADD COLUMN coaching_focus_points JSONB;