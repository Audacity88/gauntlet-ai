-- Create function to find or create DM channel
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
  user1_id UUID,
  user2_id UUID,
  user1_profile_id UUID,
  user2_profile_id UUID
) RETURNS TABLE (
  channel_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
  v_channel_id UUID;
  v_timestamp TIMESTAMPTZ;
BEGIN
  -- First try to find existing channel
  SELECT dm1.channel_id INTO v_channel_id
  FROM direct_message_members dm1
  JOIN direct_message_members dm2 ON dm1.channel_id = dm2.channel_id
  WHERE dm1.user_id = user1_id
    AND dm2.user_id = user2_id
  LIMIT 1;

  -- If no channel exists, create one
  IF v_channel_id IS NULL THEN
    v_timestamp := now();
    
    -- Create channel
    INSERT INTO direct_message_channels (created_at, updated_at)
    VALUES (v_timestamp, v_timestamp)
    RETURNING id INTO v_channel_id;

    -- Create memberships
    INSERT INTO direct_message_members (channel_id, user_id, profile_id, last_read_at, created_at)
    VALUES
      (v_channel_id, user1_id, user1_profile_id, v_timestamp, v_timestamp),
      (v_channel_id, user2_id, user2_profile_id, v_timestamp, v_timestamp);
  END IF;

  RETURN QUERY SELECT v_channel_id;
END;
$$; 