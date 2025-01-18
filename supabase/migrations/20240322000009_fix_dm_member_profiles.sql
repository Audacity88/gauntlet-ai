-- Drop existing function
DROP FUNCTION IF EXISTS find_or_create_dm_channel;

-- Create or replace the function with proper ID assignments
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
  p_user_id UUID,
  p_other_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_channel_id UUID;
  v_result jsonb;
  v_user_profile_id UUID;
  v_other_profile_id UUID;
BEGIN
  -- Log input parameters
  RAISE NOTICE 'Creating DM channel between users: p_user_id=%, p_other_user_id=%', p_user_id, p_other_user_id;

  -- Prevent self-DMs
  IF p_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a DM channel with yourself';
  END IF;

  -- Get profile IDs for both users
  SELECT id INTO v_user_profile_id FROM profiles WHERE id = p_user_id;
  SELECT id INTO v_other_profile_id FROM profiles WHERE id = p_other_user_id;

  IF v_user_profile_id IS NULL OR v_other_profile_id IS NULL THEN
    RAISE EXCEPTION 'One or both users do not have profiles';
  END IF;

  -- First try to find an existing channel
  SELECT dm1.channel_id INTO v_channel_id
  FROM direct_message_members dm1
  JOIN direct_message_members dm2 ON dm2.channel_id = dm1.channel_id
  WHERE dm1.user_id = p_user_id
    AND dm2.user_id = p_other_user_id
  LIMIT 1;

  -- Log existing channel check
  RAISE NOTICE 'Existing channel check: channel_id=%', v_channel_id;

  -- If no channel exists, create one
  IF v_channel_id IS NULL THEN
    -- Create new channel in a transaction to ensure atomicity
    BEGIN
      -- Create new channel
      INSERT INTO direct_message_channels (id)
      VALUES (gen_random_uuid())
      RETURNING id INTO v_channel_id;

      RAISE NOTICE 'Created new channel: channel_id=%', v_channel_id;

      -- Add both users as members with correct profile IDs
      INSERT INTO direct_message_members (channel_id, user_id, profile_id)
      VALUES
        (v_channel_id, p_user_id, v_other_profile_id),
        (v_channel_id, p_other_user_id, v_user_profile_id);

      RAISE NOTICE 'Added members to channel: channel_id=%, user1=(%, %), user2=(%, %)',
        v_channel_id, p_user_id, v_other_profile_id, p_other_user_id, v_user_profile_id;
    EXCEPTION WHEN OTHERS THEN
      -- If anything fails, log it and re-raise
      RAISE NOTICE 'Error in transaction: %', SQLERRM;
      RAISE;
    END;
  END IF;

  -- Return the channel ID
  v_result := jsonb_build_object('channel_id', v_channel_id);
  RETURN v_result;
END;
$$; 