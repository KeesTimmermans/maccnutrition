-- Add UPDATE and DELETE policies for wearable_data table
-- This allows users to manage their own wearable health data (correct errors, remove data)

CREATE POLICY "Users can update their own wearable data"
ON public.wearable_data
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wearable data"
ON public.wearable_data
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);