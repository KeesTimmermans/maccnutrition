-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('progress-photos', 'progress-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Create RLS policies for progress photos bucket
CREATE POLICY "Users can upload their own progress photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own progress photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own progress photos"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own progress photos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);