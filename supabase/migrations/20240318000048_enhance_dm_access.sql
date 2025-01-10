-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view direct messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON direct_messages;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_created ON direct_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_user_profile ON direct_messages (user_id, profile_id);

-- Create policies for direct_messages
CREATE POLICY "Users can view direct messages" ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dm_channel_members
      WHERE channel_id = direct_messages.channel_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send direct messages" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM dm_channel_members
      WHERE channel_id = direct_messages.channel_id
      AND user_id = auth.uid()
    )
  );

-- Enable RLS on direct_messages
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT ON direct_messages TO authenticated;
GRANT INSERT ON direct_messages TO authenticated;

-- Create a function to get messages with user profiles
CREATE OR REPLACE FUNCTION get_dm_messages_with_profiles(
  p_channel_id uuid,
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_before_timestamp timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  channel_id uuid,
  user_id uuid,
  profile_id uuid,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  username text,
  full_name text,
  avatar_url text
) AS $$
BEGIN
  -- Verify the user is the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify the user is a member of the channel
  IF NOT EXISTS (
    SELECT 1 FROM dm_channel_members
    WHERE channel_id = p_channel_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this channel';
  END IF;

  -- Return messages with user profiles
  RETURN QUERY
  SELECT 
    m.id,
    m.channel_id,
    m.user_id,
    m.profile_id,
    m.content,
    m.created_at,
    m.updated_at,
    p.username,
    p.full_name,
    p.avatar_url
  FROM direct_messages m
  JOIN profiles p ON p.id = m.profile_id
  WHERE m.channel_id = p_channel_id
  AND (p_before_timestamp IS NULL OR m.created_at < p_before_timestamp)
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dm_messages_with_profiles TO authenticated; 