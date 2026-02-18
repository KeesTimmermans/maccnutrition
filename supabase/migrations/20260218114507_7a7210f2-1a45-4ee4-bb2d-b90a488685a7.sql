CREATE TABLE public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('privacy', 'health', 'marketing')),
  policy_version text,
  accepted boolean NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent log"
  ON public.consent_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent log"
  ON public.consent_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
