-- Drop all versions of the functions
DROP FUNCTION IF EXISTS find_or_create_dm_channel(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS find_or_create_dm_channel(user1_id uuid, user2_id uuid, profile1_id uuid, profile2_id uuid);
DROP FUNCTION IF EXISTS create_dm_channel(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS create_dm_channel(user1_id uuid, user2_id uuid, profile1_id uuid, profile2_id uuid);

-- Create function to create a DM channel with explicit parameter names
CREATE OR REPLACE FUNCTION create_dm_channel(
    profile1_id uuid,
    profile2_id uuid,
    user1_id uuid,
    user2_id uuid
) RETURNS uuid AS $$
DECLARE
    v_channel_id uuid;
    v_member1_id uuid;
    v_member2_id uuid;
BEGIN
    -- Create DM channel
    INSERT INTO public.direct_message_channels (id, created_at, updated_at)
    VALUES (uuid_generate_v4(), now(), now())
    RETURNING id INTO v_channel_id;

    -- Add first user as member
    INSERT INTO public.dm_channel_members (channel_id, user_id, last_read_at, created_at)
    VALUES (v_channel_id, user1_id, now(), now())
    RETURNING id INTO v_member1_id;

    -- Add second user as member
    INSERT INTO public.dm_channel_members (channel_id, user_id, last_read_at, created_at)
    VALUES (v_channel_id, user2_id, now(), now())
    RETURNING id INTO v_member2_id;

    -- Add profile associations
    INSERT INTO public.dm_member_profiles (member_id, profile_id)
    VALUES 
        (v_member1_id, profile1_id),
        (v_member2_id, profile2_id);

    RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to find or create a DM channel with explicit parameter names
CREATE OR REPLACE FUNCTION find_or_create_dm_channel(
    profile1_id uuid,
    profile2_id uuid,
    user1_id uuid,
    user2_id uuid
) RETURNS uuid AS $$
DECLARE
    v_existing_channel_id uuid;
BEGIN
    -- Check if DM channel already exists
    SELECT dcm1.channel_id INTO v_existing_channel_id
    FROM public.dm_channel_members dcm1
    JOIN public.dm_channel_members dcm2 ON dcm1.channel_id = dcm2.channel_id
    WHERE dcm1.user_id = user1_id AND dcm2.user_id = user2_id;

    -- If channel exists, return it
    IF v_existing_channel_id IS NOT NULL THEN
        RETURN v_existing_channel_id;
    END IF;

    -- Otherwise create new channel
    RETURN create_dm_channel(profile1_id, profile2_id, user1_id, user2_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions with explicit parameter names
GRANT EXECUTE ON FUNCTION create_dm_channel(profile1_id uuid, profile2_id uuid, user1_id uuid, user2_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION find_or_create_dm_channel(profile1_id uuid, profile2_id uuid, user1_id uuid, user2_id uuid) TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON FUNCTION create_dm_channel(uuid, uuid, uuid, uuid) IS 'Creates a new DM channel between two users with parameters in order: profile1_id, profile2_id, user1_id, user2_id';
COMMENT ON FUNCTION find_or_create_dm_channel(uuid, uuid, uuid, uuid) IS 'Finds an existing DM channel between two users or creates a new one with parameters in order: profile1_id, profile2_id, user1_id, user2_id'; 