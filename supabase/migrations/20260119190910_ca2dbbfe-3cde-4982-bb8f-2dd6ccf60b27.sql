-- Enable Row Level Security on wearable_tokens table
ALTER TABLE public.wearable_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view tokens for their own wearable connections
CREATE POLICY "Users can view their own wearable tokens"
ON public.wearable_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wearable_connections wc
    WHERE wc.id = wearable_tokens.connection_id
    AND wc.user_id = auth.uid()
  )
);

-- Policy: Users can insert tokens for their own wearable connections
CREATE POLICY "Users can insert their own wearable tokens"
ON public.wearable_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wearable_connections wc
    WHERE wc.id = wearable_tokens.connection_id
    AND wc.user_id = auth.uid()
  )
);

-- Policy: Users can update tokens for their own wearable connections
CREATE POLICY "Users can update their own wearable tokens"
ON public.wearable_tokens
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.wearable_connections wc
    WHERE wc.id = wearable_tokens.connection_id
    AND wc.user_id = auth.uid()
  )
);

-- Policy: Users can delete tokens for their own wearable connections
CREATE POLICY "Users can delete their own wearable tokens"
ON public.wearable_tokens
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.wearable_connections wc
    WHERE wc.id = wearable_tokens.connection_id
    AND wc.user_id = auth.uid()
  )
);