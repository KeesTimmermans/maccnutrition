-- Add SELECT policy for wearable_tokens table
-- This restricts token viewing to the token owner via the connection's user_id

CREATE POLICY "Users can view their own wearable tokens"
ON public.wearable_tokens
FOR SELECT
USING (
  auth.uid() = (
    SELECT user_id 
    FROM public.wearable_connections 
    WHERE id = connection_id
  )
);