
-- Add notes column to meals table for storing serialized recipe/ingredient data
ALTER TABLE public.meals ADD COLUMN notes text NULL;
