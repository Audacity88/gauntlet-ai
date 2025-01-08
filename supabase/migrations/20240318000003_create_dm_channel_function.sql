-- Create function to create or get existing DM channel
CREATE OR REPLACE FUNCTION create_dm_channel(other_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_channel_id UUID;
    existing_channel_id UUID;
BEGIN
    -- First check if a DM already exists between these users
    SELECT dm1.channel_id INTO existing_channel_id
    FROM direct_message_members dm1
    INNER JOIN direct_message_members dm2 
        ON dm1.channel_id = dm2.channel_id
        AND dm1.user_id = auth.uid()
        AND dm2.user_id = other_user_id
    LIMIT 1;

    -- If exists, return existing channel
    IF existing_channel_id IS NOT NULL THEN
        RETURN json_build_object('id', existing_channel_id);
    END IF;

    -- Create new channel if no existing one found
    INSERT INTO direct_message_channels DEFAULT VALUES
    RETURNING id INTO new_channel_id;

    -- Add both members in a single statement
    INSERT INTO direct_message_members (channel_id, user_id)
    VALUES 
        (new_channel_id, auth.uid()),
        (new_channel_id, other_user_id);

    RETURN json_build_object('id', new_channel_id);
END;
$$;

-- Grant execute permission
REVOKE EXECUTE ON FUNCTION create_dm_channel FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_dm_channel TO authenticated; 