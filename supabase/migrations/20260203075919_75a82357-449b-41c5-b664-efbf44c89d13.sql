-- Add reminder preferences columns to user_baselines
ALTER TABLE public.user_baselines
ADD COLUMN IF NOT EXISTS reminders_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_meal_logging boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_water_logging boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_weekly_summary boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reminder_frequency text DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS reminder_time time DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS reminder_timezone text DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS reminder_quiet_start time DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS reminder_quiet_end time DEFAULT '07:00',
ADD COLUMN IF NOT EXISTS last_meal_reminder_sent timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_water_reminder_sent timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_weekly_summary_sent timestamp with time zone;