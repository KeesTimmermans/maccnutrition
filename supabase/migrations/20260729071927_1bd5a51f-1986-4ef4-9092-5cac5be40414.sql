CREATE TABLE public.weekly_habits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  habit_title text NOT NULL,
  habit_description text NOT NULL,
  difficulty_label text,
  completed_dates date[] NOT NULL DEFAULT '{}',
  previous_habit_id uuid REFERENCES public.weekly_habits(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

GRANT SELECT, INSERT, UPDATE ON public.weekly_habits TO authenticated;
GRANT ALL ON public.weekly_habits TO service_role;

ALTER TABLE public.weekly_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly habits"
ON public.weekly_habits FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly habits"
ON public.weekly_habits FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly habits"
ON public.weekly_habits FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_weekly_habits_updated_at
BEFORE UPDATE ON public.weekly_habits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();