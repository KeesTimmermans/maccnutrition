-- Remove the SELECT policy from wearable_tokens to prevent client access
-- The existing SECURITY DEFINER functions (get_wearable_token, update_wearable_token) 
-- handle token access server-side only

DROP POLICY IF EXISTS "Users can view their own wearable tokens" ON public.wearable_tokens;