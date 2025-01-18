-- Function to get or create a DM channel and add members
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
    p_user_id uuid,
    p_other_user_id uuid
) RETURNS jsonb AS $$
DECLARE
    v_channel_id uuid;
BEGIN
    -- First try to find an existing channel
    SELECT DISTINCT dm1.channel_id INTO v_channel_id
    FROM direct_message_members dm1
    JOIN direct_message_members dm2 ON dm1.channel_id = dm2.channel_id
    WHERE (dm1.user_id = p_user_id AND dm2.user_id = p_other_user_id)
       OR (dm1.user_id = p_other_user_id AND dm2.user_id = p_user_id)
    LIMIT 1;

    -- If no channel exists, create one
    IF v_channel_id IS NULL THEN
        -- Create new channel
        INSERT INTO direct_message_channels (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_channel_id;

        -- Add both users as members
        INSERT INTO direct_message_members (channel_id, user_id, profile_id)
        VALUES
            (v_channel_id, p_user_id, p_user_id),
            (v_channel_id, p_other_user_id, p_other_user_id)
        ON CONFLICT (channel_id, user_id) DO NOTHING;
    END IF;

    -- Return as a JSON object
    RETURN jsonb_build_object(
        'channel_id', v_channel_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a message
CREATE OR REPLACE FUNCTION send_message(
    p_channel_id uuid,
    p_user_id uuid,
    p_profile_id uuid,
    p_content text,
    p_message_type text DEFAULT 'text',
    p_parent_id uuid DEFAULT NULL,
    p_attachments jsonb DEFAULT '[]'::jsonb,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS messages AS $$
DECLARE
    v_message messages;
BEGIN
    INSERT INTO messages (
        channel_id,
        user_id,
        profile_id,
        content,
        message_type,
        parent_id,
        attachments,
        metadata
    ) VALUES (
        p_channel_id,
        p_user_id,
        p_profile_id,
        p_content,
        p_message_type,
        p_parent_id,
        p_attachments,
        p_metadata
    )
    RETURNING * INTO v_message;
    
    RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send a direct message
CREATE OR REPLACE FUNCTION send_direct_message(
    p_channel_id uuid,
    p_user_id uuid,
    p_profile_id uuid,
    p_content text,
    p_message_type text DEFAULT 'text',
    p_parent_id uuid DEFAULT NULL,
    p_attachments jsonb DEFAULT '[]'::jsonb,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS direct_messages AS $$
DECLARE
    v_message direct_messages;
BEGIN
    -- Verify the user is a member of the channel
    IF NOT EXISTS (
        SELECT 1 FROM direct_message_members
        WHERE channel_id = p_channel_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'User is not a member of this channel';
    END IF;
    
    -- Insert the message
    INSERT INTO direct_messages (
        channel_id,
        user_id,
        profile_id,
        content,
        message_type,
        parent_id,
        attachments,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        p_channel_id,
        p_user_id,
        p_profile_id,
        p_content,
        p_message_type,
        p_parent_id,
        p_attachments,
        p_metadata,
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

-- Function to get messages from a channel
CREATE OR REPLACE FUNCTION get_channel_messages(
    p_channel_id uuid,
    p_limit integer DEFAULT 50
) RETURNS SETOF messages AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM messages
    WHERE channel_id = p_channel_id
    AND deleted_at IS NULL
    ORDER BY inserted_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages from a DM channel
CREATE OR REPLACE FUNCTION get_dm_messages(
    p_channel_id uuid,
    p_limit integer DEFAULT 50
) RETURNS SETOF direct_messages AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM direct_messages
    WHERE channel_id = p_channel_id
    AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel TO authenticated;
GRANT EXECUTE ON FUNCTION send_message TO authenticated;
GRANT EXECUTE ON FUNCTION send_direct_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_dm_messages TO authenticated; 