-- Function to find or create a DM channel between two users
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(p_user_id UUID, p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel_id UUID;
BEGIN
    -- First try to find an existing channel
    SELECT dmc.id INTO v_channel_id
    FROM direct_message_channels dmc
    JOIN direct_message_members dmm1 ON dmm1.channel_id = dmc.id
    JOIN direct_message_members dmm2 ON dmm2.channel_id = dmc.id
    WHERE dmm1.user_id = p_user_id
    AND dmm2.user_id = p_other_user_id
    LIMIT 1;

    -- If no channel exists, create one
    IF v_channel_id IS NULL THEN
        -- Create new channel
        INSERT INTO direct_message_channels (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_channel_id;

        -- Add both users as members
        INSERT INTO direct_message_members (channel_id, user_id, profile_id, created_at)
        VALUES
            (v_channel_id, p_user_id, p_user_id, NOW()),
            (v_channel_id, p_other_user_id, p_other_user_id, NOW());
    END IF;

    RETURN v_channel_id;
END;
$$; 