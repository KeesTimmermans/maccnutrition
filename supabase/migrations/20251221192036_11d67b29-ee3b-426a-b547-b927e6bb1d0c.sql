-- Add DELETE policy to daily_checkins to allow users to manage their own check-ins
CREATE POLICY "Users can delete their own check-ins"
ON public.daily_checkins
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);