-- Step 1: Create a separate table for OAuth tokens with NO client access
CREATE TABLE public.wearable_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS but create NO permissive policies - only backend can access
ALTER TABLE public.wearable_tokens ENABLE ROW LEVEL SECURITY;

-- Step 2: Migrate existing tokens to the new table
INSERT INTO public.wearable_tokens (connection_id, access_token, refresh_token, token_expires_at)
SELECT id, access_token, refresh_token, token_expires_at
FROM public.wearable_connections
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

-- Step 3: Remove token columns from wearable_connections (keep only non-sensitive data)
ALTER TABLE public.wearable_connections DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.wearable_connections DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE public.wearable_connections DROP COLUMN IF EXISTS token_expires_at;

-- Step 4: Now update RLS on wearable_connections to allow proper SELECT
-- First drop the deny policy since tokens are no longer in this table
DROP POLICY IF EXISTS "Deny direct SELECT access to protect tokens" ON public.wearable_connections;

-- Add a proper SELECT policy for users to see their own connections
CREATE POLICY "Users can view their own wearable connections"
ON public.wearable_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Step 5: Create a secure backend-only function to get tokens for edge functions
CREATE OR REPLACE FUNCTION public.get_wearable_token(p_connection_id uuid)
RETURNS TABLE(
  access_token text,
  refresh_token text,
  token_expires_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wt.access_token,
    wt.refresh_token,
    wt.token_expires_at
  FROM public.wearable_tokens wt
  INNER JOIN public.wearable_connections wc ON wc.id = wt.connection_id
  WHERE wt.connection_id = p_connection_id
    AND wc.user_id = auth.uid()
$$;

-- Step 6: Create a function for backend to update tokens (for token refresh flows)
CREATE OR REPLACE FUNCTION public.update_wearable_token(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_token_expires_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the connection belongs to the current user
  IF NOT EXISTS (
    SELECT 1 FROM public.wearable_connections
    WHERE id = p_connection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Connection not found or access denied';
  END IF;

  -- Upsert the token
  INSERT INTO public.wearable_tokens (connection_id, access_token, refresh_token, token_expires_at, updated_at)
  VALUES (p_connection_id, p_access_token, p_refresh_token, p_token_expires_at, now())
  ON CONFLICT (connection_id) 
  DO UPDATE SET
    access_token = EXCLUDED.access_token,
    refresh_token = EXCLUDED.refresh_token,
    token_expires_at = EXCLUDED.token_expires_at,
    updated_at = now();
END;
$$;

-- Step 7: Add trigger for updated_at on wearable_tokens
CREATE TRIGGER update_wearable_tokens_updated_at
BEFORE UPDATE ON public.wearable_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 8: Clean up the old function that excluded tokens (no longer needed with new structure)
DROP FUNCTION IF EXISTS public.get_user_wearable_connections();