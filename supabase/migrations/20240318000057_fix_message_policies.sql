-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in channels they belong to" ON messages;

-- Recreate policies
CREATE POLICY "Users can view messages in channels they belong to"
ON messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM channel_members 
        WHERE channel_members.channel_id = messages.channel_id 
        AND channel_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Add insert policy for messages
CREATE POLICY "Users can insert messages in channels they belong to"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM channel_members 
        WHERE channel_members.channel_id = channel_id 
        AND channel_members.user_id = auth.uid()
    )
); 