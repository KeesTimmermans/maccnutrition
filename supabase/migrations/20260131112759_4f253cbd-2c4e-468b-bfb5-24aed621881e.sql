-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypt function for tokens (SECURITY DEFINER to hide key)
CREATE OR REPLACE FUNCTION public.encrypt_token(p_plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key bytea;
BEGIN
  IF p_plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use a fixed key derived from a secret
  v_key := decode(md5('wearable_encryption_key_v1'), 'hex');
  
  -- Encrypt using PGP symmetric encryption with pgcrypto
  RETURN encode(
    pgp_sym_encrypt(p_plaintext, encode(v_key, 'hex')),
    'base64'
  );
END;
$$;

-- Create decrypt function for tokens (SECURITY DEFINER to hide key)
CREATE OR REPLACE FUNCTION public.decrypt_token(p_ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key bytea;
BEGIN
  IF p_ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Use the same key for decryption
  v_key := decode(md5('wearable_encryption_key_v1'), 'hex');
  
  -- Decrypt
  RETURN pgp_sym_decrypt(
    decode(p_ciphertext, 'base64'),
    encode(v_key, 'hex')
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails (e.g., plaintext data), return null for security
    RETURN NULL;
END;
$$;

-- Encrypt existing tokens in the table (if any exist)
UPDATE public.wearable_tokens
SET 
  access_token = public.encrypt_token(access_token),
  refresh_token = public.encrypt_token(refresh_token)
WHERE access_token IS NOT NULL 
  AND access_token NOT LIKE 'LS0t%';

-- Update the get_wearable_token function to decrypt tokens
CREATE OR REPLACE FUNCTION public.get_wearable_token(p_connection_id uuid)
RETURNS TABLE(access_token text, refresh_token text, token_expires_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.decrypt_token(wt.access_token) as access_token,
    public.decrypt_token(wt.refresh_token) as refresh_token,
    wt.token_expires_at
  FROM public.wearable_tokens wt
  INNER JOIN public.wearable_connections wc ON wc.id = wt.connection_id
  WHERE wt.connection_id = p_connection_id
    AND wc.user_id = auth.uid()
$$;

-- Update the update_wearable_token function to encrypt tokens before storage
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

  -- Upsert the token with encryption
  INSERT INTO public.wearable_tokens (
    connection_id, 
    access_token, 
    refresh_token, 
    token_expires_at, 
    updated_at
  )
  VALUES (
    p_connection_id, 
    public.encrypt_token(p_access_token), 
    public.encrypt_token(p_refresh_token), 
    p_token_expires_at, 
    now()
  )
  ON CONFLICT (connection_id) 
  DO UPDATE SET
    access_token = public.encrypt_token(EXCLUDED.access_token),
    refresh_token = public.encrypt_token(EXCLUDED.refresh_token),
    token_expires_at = EXCLUDED.token_expires_at,
    updated_at = now();
END;
$$;

-- Revoke direct access to encrypt/decrypt functions from public roles
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_token(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(text) FROM authenticated;

-- Only allow authenticated users to call the wrapper functions
GRANT EXECUTE ON FUNCTION public.get_wearable_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_wearable_token(uuid, text, text, timestamp with time zone) TO authenticated;

-- Add a comment for documentation
COMMENT ON TABLE public.wearable_tokens IS 'Stores encrypted OAuth tokens for wearable device integrations. Tokens are encrypted at rest using pgcrypto PGP symmetric encryption.';