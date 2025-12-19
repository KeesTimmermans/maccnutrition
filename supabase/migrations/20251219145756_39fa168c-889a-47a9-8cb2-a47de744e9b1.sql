-- Create a secure view that excludes sensitive token columns
CREATE OR REPLACE VIEW public.wearable_connections_safe AS
SELECT 
  id,
  user_id,
  provider,
  is_connected,
  last_sync_at,
  external_user_id,
  created_at,
  updated_at
FROM public.wearable_connections;

-- Enable RLS on the view
ALTER VIEW public.wearable_connections_safe SET (security_invoker = true);

-- Drop the existing SELECT policy on the base table (tokens should never be exposed to client)
DROP POLICY IF EXISTS "Users can view their own wearable connections" ON public.wearable_connections;

-- Create a security definer function to get safe wearable connections
CREATE OR REPLACE FUNCTION public.get_user_wearable_connections()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  provider text,
  is_connected boolean,
  last_sync_at timestamptz,
  external_user_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    user_id,
    provider,
    is_connected,
    last_sync_at,
    external_user_id,
    created_at,
    updated_at
  FROM public.wearable_connections
  WHERE user_id = auth.uid()
$$;