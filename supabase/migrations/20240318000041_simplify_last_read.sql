-- Drop the old functions
DROP FUNCTION IF EXISTS update_direct_message_member_last_read;
DROP FUNCTION IF EXISTS update_dm_last_read;

-- Create a single, improved last read update function
CREATE OR REPLACE FUNCTION update_dm_last_read(
    p_channel_id uuid,
    p_user_id uuid
)
RETURNS timestamp with time zone AS $$
DECLARE
    v_timestamp timestamp with time zone;
BEGIN
    -- Update the last_read_at timestamp
    UPDATE direct_message_members
    SET last_read_at = now()
    WHERE channel_id = p_channel_id
    AND user_id = p_user_id
    RETURNING last_read_at INTO v_timestamp;

    -- If no row was updated, the user is not a member of this channel
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User % is not a member of channel %', p_user_id, p_channel_id;
    END IF;

    RETURN v_timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_dm_last_read TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION update_dm_last_read IS 'Updates the last_read_at timestamp for a user in a DM channel. Returns the new timestamp.'; 