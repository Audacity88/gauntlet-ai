-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS find_or_create_dm_channel;

-- Drop the existing view if it exists
DROP VIEW IF EXISTS direct_message_members;

-- Recreate the view with the correct columns
CREATE VIEW direct_message_members AS
SELECT 
  dm.id,
  dm.channel_id,
  dm.user_id,
  p.id as profile_id,
  dm.last_read_at,
  dm.created_at,
  p.username,
  p.full_name,
  p.avatar_url
FROM dm_channel_members dm
JOIN profiles p ON p.id = dm.user_id;

-- Function to create or find a DM channel between two users
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
  p_user_id uuid,
  p_other_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  -- Verify the user is the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- First try to find an existing channel
  SELECT DISTINCT dm1.channel_id INTO v_channel_id
  FROM dm_channel_members dm1
  JOIN dm_channel_members dm2 ON dm1.channel_id = dm2.channel_id
  WHERE (dm1.user_id = p_user_id AND dm2.user_id = p_other_user_id)
     OR (dm1.user_id = p_other_user_id AND dm2.user_id = p_user_id)
  LIMIT 1;

  -- If no channel exists, create one
  IF v_channel_id IS NULL THEN
    -- Create the channel
    INSERT INTO direct_message_channels (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_channel_id;

    -- Add both users to the channel
    INSERT INTO dm_channel_members (channel_id, user_id, created_at)
    VALUES 
      (v_channel_id, p_user_id, NOW()),
      (v_channel_id, p_other_user_id, NOW());
  END IF;

  RETURN v_channel_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel TO authenticated;

-- Create a trigger to update the channel's updated_at timestamp
CREATE OR REPLACE FUNCTION update_dm_channel_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE direct_message_channels
  SET updated_at = NOW()
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and create it
DROP TRIGGER IF EXISTS update_dm_channel_timestamp ON direct_messages;
CREATE TRIGGER update_dm_channel_timestamp
  AFTER INSERT OR UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_dm_channel_timestamp();

-- Add necessary permissions
ALTER TABLE dm_channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view DM members they are part of" ON dm_channel_members
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id 
    FROM dm_channel_members 
    WHERE channel_id = dm_channel_members.channel_id
  ));

CREATE POLICY "Users can update their own DM member records" ON dm_channel_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT ON dm_channel_members TO authenticated;
GRANT UPDATE (last_read_at) ON dm_channel_members TO authenticated;
GRANT SELECT ON direct_message_members TO authenticated; 


-- Function to send a direct message and update channel timestamp
CREATE OR REPLACE FUNCTION send_direct_message(
  p_channel_id uuid,
  p_user_id uuid,
  p_profile_id uuid,
  p_content text
) RETURNS direct_messages AS $$
DECLARE
  v_message direct_messages;
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

  -- Insert the message
  INSERT INTO direct_messages (
    channel_id,
    user_id,
    profile_id,
    content,
    created_at,
    updated_at
  ) VALUES (
    p_channel_id,
    p_user_id,
    p_profile_id,
    p_content,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_message;

  -- Update channel timestamp
  UPDATE direct_message_channels
  SET updated_at = NOW()
  WHERE id = p_channel_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION send_direct_message TO authenticated;

-- Function to get DM messages for a channel
CREATE OR REPLACE FUNCTION get_dm_messages(
  p_channel_id uuid,
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_before_timestamp timestamptz DEFAULT NULL
) RETURNS SETOF direct_messages AS $$
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

  -- Return messages
  RETURN QUERY
  SELECT *
  FROM direct_messages
  WHERE channel_id = p_channel_id
  AND (p_before_timestamp IS NULL OR created_at < p_before_timestamp)
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dm_messages TO authenticated; 