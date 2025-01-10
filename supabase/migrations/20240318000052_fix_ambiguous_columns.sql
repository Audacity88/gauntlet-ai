-- Drop the old function
DROP FUNCTION IF EXISTS get_dm_channels_for_user(uuid);

-- Create improved function with fixed column references
CREATE OR REPLACE FUNCTION get_dm_channels_for_user(user_uuid uuid)
RETURNS TABLE (
    channel_id uuid,
    other_user_id uuid,
    other_profile_id uuid,
    other_username text,
    other_full_name text,
    other_avatar_url text,
    last_read_at timestamp with time zone,
    last_message_at timestamp with time zone,
    last_message_content text,
    unread_count bigint
) AS $$
BEGIN
    -- Verify the user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user_uuid) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (dm.channel_id)
            dm.channel_id,
            dm.created_at as last_message_at,
            dm.content as last_message_content
        FROM direct_messages dm
        ORDER BY dm.channel_id, dm.created_at DESC
    ),
    unread_messages AS (
        SELECT 
            dm.channel_id,
            COUNT(*) as unread_count
        FROM direct_messages dm
        JOIN dm_channel_members dmm ON dmm.channel_id = dm.channel_id
        WHERE dmm.user_id = user_uuid
        AND (dmm.last_read_at IS NULL OR dm.created_at > dmm.last_read_at)
        GROUP BY dm.channel_id
    )
    SELECT DISTINCT
        dmm.channel_id,
        other_member.user_id as other_user_id,
        other_member.user_id as other_profile_id,
        p.username as other_username,
        p.full_name as other_full_name,
        p.avatar_url as other_avatar_url,
        dmm.last_read_at,
        COALESCE(lm.last_message_at, dmm.created_at) as last_message_at,
        lm.last_message_content,
        COALESCE(um.unread_count, 0) as unread_count
    FROM dm_channel_members dmm
    -- Get the other member of each channel
    JOIN dm_channel_members other_member ON 
        other_member.channel_id = dmm.channel_id AND 
        other_member.user_id != user_uuid
    -- Get the other member's profile information
    JOIN profiles p ON p.id = other_member.user_id
    -- Get the latest message for each channel
    LEFT JOIN latest_messages lm ON lm.channel_id = dmm.channel_id
    -- Get unread count for each channel
    LEFT JOIN unread_messages um ON um.channel_id = dmm.channel_id
    -- Only get channels where the user is a member
    WHERE dmm.user_id = user_uuid
    ORDER BY COALESCE(lm.last_message_at, dmm.created_at) DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_dm_channels_for_user(uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_dm_channels_for_user(uuid) IS 'Gets all DM channels for a user with complete information about the other participant and message status.'; 