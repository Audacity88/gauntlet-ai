-- Enable RLS on the tables
ALTER TABLE dm_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their DM channel members" ON dm_channel_members;
DROP POLICY IF EXISTS "Users can insert DM channel members" ON dm_channel_members;
DROP POLICY IF EXISTS "Users can manage their DM channel members" ON dm_channel_members;
DROP POLICY IF EXISTS "Users can manage their channels" ON direct_message_channels;

-- Simple policy for dm_channel_members
CREATE POLICY "Users can manage their DM channel members"
ON dm_channel_members
AS PERMISSIVE
FOR ALL
USING (
  -- Can access if you are the member
  user_id = auth.uid()
)
WITH CHECK (
  -- Can insert if authenticated
  auth.uid() IS NOT NULL
);

-- Simple policy for direct_message_channels
CREATE POLICY "Users can manage their channels"
ON direct_message_channels
AS PERMISSIVE
FOR ALL
USING (
  -- Can access if authenticated (the functions handle the business logic)
  auth.uid() IS NOT NULL
)
WITH CHECK (
  -- Can insert if authenticated
  auth.uid() IS NOT NULL
);

-- Grant necessary permissions
GRANT SELECT, INSERT ON dm_channel_members TO authenticated;
GRANT SELECT, INSERT ON direct_message_channels TO authenticated;

-- Refresh the materialized view to ensure it's up to date
REFRESH MATERIALIZED VIEW dm_channel_access;

-- Grant permissions on the materialized view
GRANT SELECT ON dm_channel_access TO authenticated;

-- Drop and recreate policies that depend on the materialized view
DROP POLICY IF EXISTS "Users can view direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;

CREATE POLICY "Users can view direct messages"
ON direct_messages
FOR SELECT
USING (
  channel_id IN (
    SELECT channel_id
    FROM dm_channel_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send direct messages"
ON direct_messages
FOR INSERT
WITH CHECK (
  channel_id IN (
    SELECT channel_id
    FROM dm_channel_members
    WHERE user_id = auth.uid()
  )
); 