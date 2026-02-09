
-- Email daily log for tracking sent emails per user per day
CREATE TABLE public.email_daily_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  morning_sent boolean NOT NULL DEFAULT false,
  followup_count integer NOT NULL DEFAULT 0,
  last_followup_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- RLS: service-role only (deny all public access)
ALTER TABLE public.email_daily_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to email daily log"
  ON public.email_daily_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
