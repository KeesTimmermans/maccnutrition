-- Create email_confirmations table for tracking email events
CREATE TABLE public.email_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_event JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on email for quick lookups
CREATE INDEX idx_email_confirmations_email ON public.email_confirmations(email);

-- Create index on email_id for idempotency checks
CREATE INDEX idx_email_confirmations_email_id ON public.email_confirmations(email_id);

-- Enable Row Level Security
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

-- No public access policies - this table is only accessed by the service role
-- from the webhook edge function. Admins can query via service role key.