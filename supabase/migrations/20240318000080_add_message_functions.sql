-- Function to get or create a DM channel and add members
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(
    p_channel_id uuid,
    p_user_id uuid,
    p_target_user_id uuid
) RETURNS direct_message_channels AS $$
DECLARE
    v_channel direct_message_channels;
BEGIN
    -- Try to get existing channel
    SELECT * INTO v_channel
    FROM direct_message_channels
    WHERE id = p_channel_id;
    
    -- If channel doesn't exist, create it
    IF v_channel IS NULL THEN
        INSERT INTO direct_message_channels (id)
        VALUES (p_channel_id)
        RETURNING * INTO v_channel;
        
        -- Add both users as members
        INSERT INTO dm_channel_members (channel_id, user_id)
        VALUES 
            (p_channel_id, p_user_id),
            (p_channel_id, p_target_user_id)
        ON CONFLICT (channel_id, user_id) DO NOTHING;
    END IF;
    
    RETURN v_channel;
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
        SELECT 1 FROM dm_channel_members
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
GRANT EXECUTE ON FUNCTION get_or_create_dm_channel TO authenticated;
GRANT EXECUTE ON FUNCTION send_message TO authenticated;
GRANT EXECUTE ON FUNCTION send_direct_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_dm_messages TO authenticated; 