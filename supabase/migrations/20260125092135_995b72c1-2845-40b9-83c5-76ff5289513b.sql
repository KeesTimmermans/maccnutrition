-- Add dashboard_layout column to store user's preferred section order and visibility
ALTER TABLE public.user_baselines 
ADD COLUMN dashboard_layout jsonb DEFAULT '{"sections": ["progress", "meals", "coach", "planner", "water", "wearables"], "hidden": []}'::jsonb;