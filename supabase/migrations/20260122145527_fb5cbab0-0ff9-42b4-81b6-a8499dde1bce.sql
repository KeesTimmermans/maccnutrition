-- Deny all public access to email_confirmations table
-- This table is only accessed server-side by the resend-webhook edge function using service role key

-- Policy to deny all SELECT access
CREATE POLICY "No public access to email confirmations"
ON public.email_confirmations
FOR ALL
USING (false)
WITH CHECK (false);