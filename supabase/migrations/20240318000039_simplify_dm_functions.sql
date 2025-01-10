-- Drop the old functions
DROP FUNCTION IF EXISTS create_dm_channel(uuid);
DROP FUNCTION IF EXISTS create_dm_channel(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS get_or_create_dm_channel;

-- Keep find_or_create_dm_channel but improve it
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
    user1_id uuid,
    profile1_id uuid,
    user2_id uuid,
    profile2_id uuid
)
RETURNS uuid AS $$
DECLARE
    v_channel_id uuid;
BEGIN
    -- First try to find an existing channel between these users
    SELECT dmc.id INTO v_channel_id
    FROM direct_message_channels dmc
    WHERE EXISTS (
        SELECT 1 
        FROM direct_message_members dmm1
        JOIN direct_message_members dmm2 ON dmm2.channel_id = dmm1.channel_id
        WHERE dmm1.channel_id = dmc.id
        AND dmm1.user_id = user1_id
        AND dmm2.user_id = user2_id
    )
    LIMIT 1;

    -- If no channel exists, create one
    IF v_channel_id IS NULL THEN
        -- Create the channel
        INSERT INTO direct_message_channels (created_at, updated_at)
        VALUES (now(), now())
        RETURNING id INTO v_channel_id;

        -- Add both members
        INSERT INTO direct_message_members (channel_id, user_id, profile_id, last_read_at)
        VALUES
            (v_channel_id, user1_id, profile1_id, now()),
            (v_channel_id, user2_id, profile2_id, now());
    END IF;

    RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION find_or_create_dm_channel IS 'Finds or creates a DM channel between two users. Returns the channel ID.'; 