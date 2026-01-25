-- Add new columns for job activity, workout type, and body measurements
ALTER TABLE public.user_baselines 
ADD COLUMN IF NOT EXISTS job_activity_level text,
ADD COLUMN IF NOT EXISTS workout_types text[],
ADD COLUMN IF NOT EXISTS body_fat_percentage numeric,
ADD COLUMN IF NOT EXISTS waist_cm numeric,
ADD COLUMN IF NOT EXISTS hip_cm numeric,
ADD COLUMN IF NOT EXISTS chest_cm numeric,
ADD COLUMN IF NOT EXISTS arm_cm numeric,
ADD COLUMN IF NOT EXISTS thigh_cm numeric,
ADD COLUMN IF NOT EXISTS neck_cm numeric,
ADD COLUMN IF NOT EXISTS progress_photo_url text,
ADD COLUMN IF NOT EXISTS measurements_updated_at timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.user_baselines.job_activity_level IS 'sedentary, light, moderate, or active - describes job physical demands';
COMMENT ON COLUMN public.user_baselines.workout_types IS 'Array of workout types: weightlifting, yoga, crossfit, running, etc.';
COMMENT ON COLUMN public.user_baselines.body_fat_percentage IS 'User-reported body fat percentage';
COMMENT ON COLUMN public.user_baselines.waist_cm IS 'Waist circumference in cm';
COMMENT ON COLUMN public.user_baselines.hip_cm IS 'Hip circumference in cm';
COMMENT ON COLUMN public.user_baselines.chest_cm IS 'Chest circumference in cm';
COMMENT ON COLUMN public.user_baselines.arm_cm IS 'Arm circumference in cm';
COMMENT ON COLUMN public.user_baselines.thigh_cm IS 'Thigh circumference in cm';
COMMENT ON COLUMN public.user_baselines.neck_cm IS 'Neck circumference in cm';
COMMENT ON COLUMN public.user_baselines.measurements_updated_at IS 'Last time measurements were updated';