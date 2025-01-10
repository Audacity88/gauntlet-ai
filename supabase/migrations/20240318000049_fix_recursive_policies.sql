-- Drop existing policies to avoid recursion
DROP POLICY IF EXISTS "Users can view direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can view DM members they are part of" ON dm_channel_members;

-- Create a materialized view for DM channel memberships
CREATE MATERIALIZED VIEW dm_channel_access AS
SELECT DISTINCT channel_id, array_agg(user_id) as member_ids
FROM dm_channel_members
GROUP BY channel_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX ON dm_channel_access (channel_id);

-- Create non-recursive policies for dm_channel_members
CREATE POLICY "Users can view their own DM memberships"
  ON dm_channel_members FOR SELECT
  USING (user_id = auth.uid());

-- Create non-recursive policies for direct_messages
CREATE POLICY "Users can view direct messages"
  ON direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM dm_channel_access
      WHERE channel_id = direct_messages.channel_id
      AND auth.uid() = ANY(member_ids)
    )
  );

CREATE POLICY "Users can send direct messages"
  ON direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM dm_channel_access
      WHERE channel_id = direct_messages.channel_id
      AND auth.uid() = ANY(member_ids)
    )
  );

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dm_access()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dm_channel_access;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh the view
CREATE TRIGGER refresh_dm_access_trigger
    AFTER INSERT OR UPDATE OR DELETE ON dm_channel_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_dm_access();

-- Grant necessary permissions
GRANT SELECT ON dm_channel_access TO authenticated; 