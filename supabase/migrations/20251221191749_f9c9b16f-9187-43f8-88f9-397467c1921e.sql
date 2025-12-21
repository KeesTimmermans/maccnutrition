-- Add DELETE policy to user_baselines to allow users to manage their own health data
CREATE POLICY "Users can delete their own baseline"
ON public.user_baselines
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);