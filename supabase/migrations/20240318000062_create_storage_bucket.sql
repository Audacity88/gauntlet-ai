-- Create storage bucket for message attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'message-attachments'
);

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'message-attachments'
);

-- Allow file owners to delete their files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'message-attachments' AND
    CAST(SPLIT_PART(name, '/', 2) AS UUID) = auth.uid()
);

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;

-- Grant all on storage objects to authenticated users
GRANT ALL ON storage.objects TO authenticated; 