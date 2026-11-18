ALTER TABLE public.weekly_habits ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.weekly_habits ADD CONSTRAINT weekly_habits_category_check
  CHECK (category IS NULL OR category IN ('nutrition', 'sleep', 'stress', 'hydration'));
COMMENT ON COLUMN public.weekly_habits.category IS 'nutrition | sleep | stress | hydration; NULL for habits created before categories (classified by keywords when read).';

GRANT DELETE ON public.daily_checklists TO authenticated;
CREATE POLICY "Users can delete their own daily checklists"
  ON public.daily_checklists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);