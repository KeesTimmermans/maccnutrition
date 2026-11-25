CREATE TABLE public.off_category_cache (
  key text PRIMARY KEY,
  products jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.off_category_cache TO service_role;
ALTER TABLE public.off_category_cache ENABLE ROW LEVEL SECURITY;