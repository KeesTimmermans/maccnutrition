-- Add explicit SELECT policy that denies all direct access to wearable_connections
-- This ensures OAuth tokens can never be read directly from the client
-- Users must use the get_user_wearable_connections() function which excludes sensitive fields

CREATE POLICY "Deny direct SELECT access to protect tokens"
ON public.wearable_connections
FOR SELECT
TO authenticated
USING (false);