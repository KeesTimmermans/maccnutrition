
-- Competition preps table
CREATE TABLE public.competition_preps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_date date NOT NULL,
  division text NOT NULL DEFAULT 'open',
  primary_goal text NOT NULL,
  goal_weight numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  current_phase text NULL,
  current_mode text NULL,
  calorie_target integer NULL,
  protein_grams integer NULL,
  carb_grams integer NULL,
  fat_grams integer NULL,
  training_day_calories integer NULL,
  rest_day_calories integer NULL,
  weight_loss_rate_pct numeric NULL,
  phase_explanation text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_preps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preps" ON public.competition_preps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preps" ON public.competition_preps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preps" ON public.competition_preps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own preps" ON public.competition_preps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Competition weekly check-ins table
CREATE TABLE public.competition_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prep_id uuid NOT NULL REFERENCES public.competition_preps(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  avg_weight numeric NULL,
  adherence_pct integer NULL,
  hunger_level integer NULL,
  energy_level integer NULL,
  recovery_level integer NULL,
  performance_trend text NULL,
  cycle_phase text NULL,
  notes text NULL,
  adjustments_applied jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competition_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" ON public.competition_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON public.competition_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.competition_checkins FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checkins" ON public.competition_checkins FOR DELETE TO authenticated USING (auth.uid() = user_id);
