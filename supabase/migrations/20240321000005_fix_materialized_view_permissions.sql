-- Switch to postgres role for all operations
SET ROLE postgres;

-- Drop dependent functions first
DROP FUNCTION IF EXISTS get_user_channels(uuid);

-- Drop dependent policies first
DROP POLICY IF EXISTS "Users can view direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can view DM channel members" ON dm_channel_members;
DROP POLICY IF EXISTS "Users can create DM channel members" ON dm_channel_members;

-- Drop and recreate the materialized view
DROP MATERIALIZED VIEW IF EXISTS dm_channel_access CASCADE;

-- Switch to authenticated role to create the view
SET ROLE authenticated;

-- Create the materialized view owned by authenticated
CREATE MATERIALIZED VIEW dm_channel_access AS
SELECT DISTINCT ON (channel_id) channel_id, user_id
FROM dm_channel_members
ORDER BY channel_id, user_id;

-- Drop existing index if it exists
DROP INDEX IF EXISTS dm_channel_access_channel_id_idx;

-- Create index owned by authenticated
CREATE UNIQUE INDEX dm_channel_access_channel_id_idx ON dm_channel_access (channel_id);

-- Switch back to postgres for remaining operations
SET ROLE postgres;

-- Create simplified policies for dm_channel_members
CREATE POLICY "Users can view DM channel members"
ON dm_channel_members
FOR SELECT
USING (
  user_id = auth.uid()
);

CREATE POLICY "Users can create DM channel members"
ON dm_channel_members
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Create policies for direct_messages using the materialized view
CREATE POLICY "Users can view direct messages"
ON direct_messages
FOR SELECT
USING (
  channel_id IN (
    SELECT channel_id 
    FROM dm_channel_access 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send direct messages"
ON direct_messages
FOR INSERT
WITH CHECK (
  channel_id IN (
    SELECT channel_id 
    FROM dm_channel_access 
    WHERE user_id = auth.uid()
  )
);

-- Enable RLS on both tables
ALTER TABLE dm_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated role
GRANT SELECT, INSERT ON dm_channel_members TO authenticated;
GRANT SELECT, INSERT ON direct_messages TO authenticated;

-- Recreate get_user_channels function to use the materialized view
CREATE OR REPLACE FUNCTION get_user_channels(user_id uuid)
RETURNS TABLE (
    channel_id uuid,
    channel_type text,
    latest_message_at timestamp with time zone,
    unread_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dma.channel_id,
        'dm'::text as channel_type,
        MAX(dm.created_at) as latest_message_at,
        COUNT(dm.id) FILTER (WHERE dm.created_at > dmm.last_read_at) as unread_count
    FROM dm_channel_access dma
    JOIN dm_channel_members dmm ON dmm.channel_id = dma.channel_id
    LEFT JOIN direct_messages dm ON dm.channel_id = dma.channel_id
    WHERE dma.user_id = $1
    GROUP BY dma.channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_channels TO authenticated;

-- Initial refresh of the materialized view
SET ROLE authenticated;
REFRESH MATERIALIZED VIEW dm_channel_access; 