-- Revoke public/authenticated EXECUTE on token crypto helpers; they are
-- only meant to be used internally by other SECURITY DEFINER wrappers.
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(text) TO service_role;