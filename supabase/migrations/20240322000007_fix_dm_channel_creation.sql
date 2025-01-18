-- Drop existing function if it exists
DROP FUNCTION IF EXISTS find_or_create_dm_channel;

-- Drop and recreate constraints
DO $$ 
DECLARE
    v_constraint_exists boolean;
BEGIN
    -- Drop old constraints if they exist
    ALTER TABLE direct_message_members 
    DROP CONSTRAINT IF EXISTS prevent_self_dms,
    DROP CONSTRAINT IF EXISTS unique_dm_channel_members,
    DROP CONSTRAINT IF EXISTS dm_members_prevent_self_dms,
    DROP CONSTRAINT IF EXISTS dm_members_unique_channel_profile;

    -- Drop old indexes if they exist
    DROP INDEX IF EXISTS unique_dm_channel_members;

    -- Check if new constraints already exist
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'dm_members_prevent_self_dms'
    ) INTO v_constraint_exists;

    -- Add self-DM prevention constraint if it doesn't exist
    IF NOT v_constraint_exists THEN
        ALTER TABLE direct_message_members
        ADD CONSTRAINT dm_members_prevent_self_dms
        CHECK (user_id <> profile_id);
    END IF;

    -- Check if unique constraint exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'dm_members_unique_channel_user'
    ) INTO v_constraint_exists;

    -- Add unique constraint if it doesn't exist
    IF NOT v_constraint_exists THEN
        ALTER TABLE direct_message_members
        ADD CONSTRAINT dm_members_unique_channel_user
        UNIQUE (channel_id, user_id);
    END IF;
END $$;

-- Create or replace the function with proper checks
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
BEGIN
  -- Log input parameters
  RAISE NOTICE 'Creating DM channel between users: p_user_id=%, p_other_user_id=%', p_user_id, p_other_user_id;

  -- Prevent self-DMs
  IF p_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create a DM channel with yourself';
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

      -- Add both users as members
      INSERT INTO direct_message_members (channel_id, user_id, profile_id)
      VALUES
        (v_channel_id, p_user_id, p_other_user_id),
        (v_channel_id, p_other_user_id, p_user_id);

      RAISE NOTICE 'Added members to channel: channel_id=%, user1=(%, %), user2=(%, %)',
        v_channel_id, p_user_id, p_other_user_id, p_other_user_id, p_user_id;
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