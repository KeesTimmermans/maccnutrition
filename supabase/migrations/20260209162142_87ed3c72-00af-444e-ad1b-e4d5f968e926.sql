
-- Track daily push notification state per user
CREATE TABLE public.push_daily_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  morning_sent boolean NOT NULL DEFAULT false,
  followup_count integer NOT NULL DEFAULT 0,
  last_followup_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- Enable RLS
ALTER TABLE public.push_daily_log ENABLE ROW LEVEL SECURITY;

-- Service-role only access (no direct user access needed)
CREATE POLICY "No public access to push daily log"
  ON public.push_daily_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
