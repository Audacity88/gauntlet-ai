-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can create DM channels" ON direct_message_channels;

-- Create INSERT policy for direct_message_channels
CREATE POLICY "Users can create DM channels"
  ON direct_message_channels
  FOR INSERT
  WITH CHECK (true);  -- Allow authenticated users to create channels

-- Grant INSERT permission to authenticated users
GRANT INSERT ON direct_message_channels TO authenticated; 