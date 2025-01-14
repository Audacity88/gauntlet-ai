-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can delete their DM channels" ON direct_message_channels;
DROP POLICY IF EXISTS "Users can delete their DM messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can delete their DM memberships" ON dm_channel_members;

-- Add DELETE policies for DM tables
CREATE POLICY "Users can delete their DM channels" ON direct_message_channels
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM dm_channel_members WHERE channel_id = id
    )
  );

CREATE POLICY "Users can delete their DM messages" ON direct_messages
  FOR DELETE USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT user_id FROM dm_channel_members WHERE channel_id = channel_id
    )
  );

CREATE POLICY "Users can delete their DM memberships" ON dm_channel_members
  FOR DELETE USING (
    auth.uid() = user_id OR
    channel_id IN (
      SELECT channel_id FROM dm_channel_members WHERE user_id = auth.uid()
    )
  );

-- Grant DELETE permissions to authenticated users
GRANT DELETE ON direct_message_channels TO authenticated;
GRANT DELETE ON direct_messages TO authenticated;
GRANT DELETE ON dm_channel_members TO authenticated; 