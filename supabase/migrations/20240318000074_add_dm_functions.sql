-- Function to find or create a DM channel between two users
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(p_user_id UUID, p_other_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_channel_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Verify the user is the authenticated user
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- First try to find an existing channel
    SELECT DISTINCT dmc.id, dmc.created_at INTO v_channel_id, v_created_at
    FROM direct_message_channels dmc
    JOIN direct_message_members dmm1 ON dmm1.channel_id = dmc.id
    JOIN direct_message_members dmm2 ON dmm2.channel_id = dmc.id
    WHERE (dmm1.user_id = p_user_id AND dmm2.user_id = p_other_user_id)
       OR (dmm1.user_id = p_other_user_id AND dmm2.user_id = p_user_id)
    LIMIT 1;

    -- If no channel exists, create one
    IF v_channel_id IS NULL THEN
        -- Create new channel
        INSERT INTO direct_message_channels (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id, created_at INTO v_channel_id, v_created_at;

        -- Add both users as members
        INSERT INTO direct_message_members (channel_id, user_id, profile_id, created_at)
        VALUES
            (v_channel_id, p_user_id, p_user_id, NOW()),
            (v_channel_id, p_other_user_id, p_other_user_id, NOW())
        ON CONFLICT (channel_id, user_id) DO NOTHING;
    END IF;

    -- Return as a JSON object
    RETURN jsonb_build_object(
        'channel_id', v_channel_id,
        'created_at', v_created_at
    );
END;
$$;

-- Function to get messages with user profiles
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
        SELECT 1 FROM direct_message_members dmm
        WHERE dmm.channel_id = p_channel_id
        AND dmm.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is not a member of this channel';
    END IF;

    -- Return messages with user profiles
    RETURN QUERY
    SELECT 
        dm.id,
        dm.channel_id,
        dm.user_id,
        dm.profile_id,
        dm.content,
        dm.created_at,
        dm.updated_at,
        p.username,
        p.full_name,
        p.avatar_url
    FROM direct_messages dm
    JOIN profiles p ON p.id = dm.profile_id
    WHERE dm.channel_id = p_channel_id
    AND (p_before_timestamp IS NULL OR dm.created_at < p_before_timestamp)
    ORDER BY dm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel TO authenticated;
GRANT EXECUTE ON FUNCTION get_dm_messages_with_profiles TO authenticated; 