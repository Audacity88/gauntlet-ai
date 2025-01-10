-- Drop existing functions
DROP FUNCTION IF EXISTS find_or_create_dm_channel;
DROP FUNCTION IF EXISTS create_dm_channel;

-- Create function to create a DM channel
CREATE OR REPLACE FUNCTION create_dm_channel(
    user1_id uuid,
    user2_id uuid,
    profile1_id uuid,
    profile2_id uuid
) RETURNS uuid AS $$
DECLARE
    channel_id uuid;
BEGIN
    -- Create DM channel
    INSERT INTO public.direct_message_channels (id, created_at, updated_at)
    VALUES (uuid_generate_v4(), now(), now())
    RETURNING id INTO channel_id;

    -- Add both users as members using our new structure
    INSERT INTO public.dm_channel_members (channel_id, user_id, last_read_at, created_at)
    VALUES
        (channel_id, user1_id, now(), now()),
        (channel_id, user2_id, now(), now())
    RETURNING id INTO channel_id;

    -- Add profile associations
    INSERT INTO public.dm_member_profiles (member_id, profile_id)
    SELECT id, profile1_id
    FROM public.dm_channel_members
    WHERE channel_id = channel_id AND user_id = user1_id;

    INSERT INTO public.dm_member_profiles (member_id, profile_id)
    SELECT id, profile2_id
    FROM public.dm_channel_members
    WHERE channel_id = channel_id AND user_id = user2_id;

    RETURN channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to find or create a DM channel
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
    user1_id uuid,
    user2_id uuid,
    profile1_id uuid,
    profile2_id uuid
) RETURNS uuid AS $$
DECLARE
    existing_channel_id uuid;
BEGIN
    -- Check if DM channel already exists
    SELECT dcm1.channel_id INTO existing_channel_id
    FROM public.dm_channel_members dcm1
    JOIN public.dm_channel_members dcm2 ON dcm1.channel_id = dcm2.channel_id
    WHERE dcm1.user_id = user1_id AND dcm2.user_id = user2_id;

    -- If channel exists, return it
    IF existing_channel_id IS NOT NULL THEN
        RETURN existing_channel_id;
    END IF;

    -- Otherwise create new channel
    RETURN create_dm_channel(user1_id, user2_id, profile1_id, profile2_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_dm_channel TO authenticated;
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON FUNCTION create_dm_channel IS 'Creates a new DM channel between two users';
COMMENT ON FUNCTION find_or_create_dm_channel IS 'Finds an existing DM channel between two users or creates a new one'; 