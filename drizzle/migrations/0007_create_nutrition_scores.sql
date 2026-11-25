CREATE TABLE public.nutrition_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL,
  total_score int NOT NULL,
  area_scores jsonb NOT NULL,
  focus_area text NOT NULL,
  reminder_sent_at timestamptz
);
CREATE INDEX nutrition_scores_user_taken_idx ON public.nutrition_scores (user_id, taken_at DESC);
GRANT SELECT, INSERT ON public.nutrition_scores TO authenticated;
GRANT ALL ON public.nutrition_scores TO service_role;
ALTER TABLE public.nutrition_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own nutrition scores" ON public.nutrition_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own nutrition scores" ON public.nutrition_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND reminder_sent_at IS NULL);