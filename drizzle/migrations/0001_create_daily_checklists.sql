CREATE TABLE public.daily_checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  checklist_date date NOT NULL,
  items jsonb NOT NULL,
  completed jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checklist_date)
);

GRANT SELECT, INSERT, UPDATE ON public.daily_checklists TO authenticated;
GRANT ALL ON public.daily_checklists TO service_role;

ALTER TABLE public.daily_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily checklists"
ON public.daily_checklists FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily checklists"
ON public.daily_checklists FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily checklists"
ON public.daily_checklists FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_daily_checklists_updated_at
BEFORE UPDATE ON public.daily_checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();