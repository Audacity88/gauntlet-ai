-- Drop redundant tables
DROP TABLE IF EXISTS dm_member_profiles CASCADE;

-- Ensure indexes exist on the base tables
CREATE INDEX IF NOT EXISTS idx_dm_channel_members_user 
ON dm_channel_members (user_id);

-- Create or replace the function to update last_read_at
CREATE OR REPLACE FUNCTION update_direct_message_member_last_read(
    p_member_id uuid,
    p_last_read_at timestamp with time zone
) RETURNS void AS $$
BEGIN
    -- Check if user has access
    IF NOT EXISTS (
        SELECT 1 FROM dm_channel_members
        WHERE id = p_member_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Update last_read_at
    UPDATE dm_channel_members
    SET last_read_at = p_last_read_at
    WHERE id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION update_direct_message_member_last_read TO authenticated; 