CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_date date NOT NULL,
  workout_type text NOT NULL,
  duration_minutes integer,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  photo_url text,
  exercises jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workouts"
  ON public.workouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workouts"
  ON public.workouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
  ON public.workouts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
  ON public.workouts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_workouts_user_date ON public.workouts (user_id, workout_date DESC);

CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();