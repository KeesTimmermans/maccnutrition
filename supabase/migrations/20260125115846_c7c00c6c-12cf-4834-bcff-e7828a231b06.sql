-- Add columns for 4 progress photo angles
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS progress_photo_front TEXT,
ADD COLUMN IF NOT EXISTS progress_photo_back TEXT,
ADD COLUMN IF NOT EXISTS progress_photo_left TEXT,
ADD COLUMN IF NOT EXISTS progress_photo_right TEXT;

-- Migrate existing single photo to front if it exists
UPDATE public.user_baselines 
SET progress_photo_front = progress_photo_url 
WHERE progress_photo_url IS NOT NULL AND progress_photo_front IS NULL;