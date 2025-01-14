-- Function to delete a DM channel and all related data
CREATE OR REPLACE FUNCTION delete_dm_channel(
  p_channel_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Delete all messages first (due to foreign key constraints)
  DELETE FROM direct_messages
  WHERE channel_id = p_channel_id;

  -- Delete all members
  DELETE FROM dm_channel_members
  WHERE channel_id = p_channel_id;

  -- Finally delete the channel
  DELETE FROM direct_message_channels
  WHERE id = p_channel_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_dm_channel TO authenticated; 