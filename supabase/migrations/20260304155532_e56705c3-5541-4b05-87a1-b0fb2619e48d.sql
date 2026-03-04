-- Idempotency store for Coach Mac chat requests
CREATE TABLE IF NOT EXISTS public.coach_message_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  client_message_id TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, client_message_id)
);

ALTER TABLE public.coach_message_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own idempotency rows"
ON public.coach_message_idempotency
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own idempotency rows"
ON public.coach_message_idempotency
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own idempotency rows"
ON public.coach_message_idempotency
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_coach_message_idempotency_updated_at
ON public.coach_message_idempotency;

CREATE TRIGGER update_coach_message_idempotency_updated_at
BEFORE UPDATE ON public.coach_message_idempotency
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();