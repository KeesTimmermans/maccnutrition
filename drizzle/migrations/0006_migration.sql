CREATE TABLE public.label_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  read_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX label_reads_user_date_idx ON public.label_reads (user_id, read_date);
GRANT ALL ON public.label_reads TO service_role;
ALTER TABLE public.label_reads ENABLE ROW LEVEL SECURITY;