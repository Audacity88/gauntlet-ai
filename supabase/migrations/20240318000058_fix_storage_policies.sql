-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read files from accessible messages" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own files" ON storage.objects;

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'message-attachments' AND
    array_length(storage.foldername(name), 1) >= 1 AND
    (storage.foldername(name))[1] = 'attachments'
);

-- Allow users to read files from messages they can access
CREATE POLICY "Allow users to read files from accessible messages"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'message-attachments' AND
    array_length(storage.foldername(name), 1) >= 2 AND
    EXISTS (
        SELECT 1
        FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id
        WHERE 
            cm.user_id = auth.uid() AND
            (storage.foldername(name))[1] = 'attachments' AND
            (storage.foldername(name))[2] = m.id::text
    )
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'message-attachments' AND
    array_length(storage.foldername(name), 1) >= 2 AND
    EXISTS (
        SELECT 1
        FROM messages m
        WHERE 
            m.user_id = auth.uid() AND
            (storage.foldername(name))[1] = 'attachments' AND
            (storage.foldername(name))[2] = m.id::text
    )
); 