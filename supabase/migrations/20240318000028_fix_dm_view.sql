-- Drop existing objects
DROP VIEW IF EXISTS public.direct_message_members CASCADE;

-- Create a secure view with access control in the definition
CREATE OR REPLACE VIEW public.direct_message_members AS
SELECT 
    dcm.id,
    dcm.channel_id,
    dcm.user_id,
    dmp.profile_id,
    dcm.last_read_at,
    dcm.created_at
FROM public.dm_channel_members dcm
LEFT JOIN public.dm_member_profiles dmp ON dmp.member_id = dcm.id
WHERE dcm.user_id = auth.uid()
   OR dcm.channel_id IN (
      SELECT channel_id 
      FROM public.dm_channel_members 
      WHERE user_id = auth.uid()
   );

-- Grant access to the view
GRANT SELECT ON public.direct_message_members TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON VIEW public.direct_message_members IS 'Direct message members with access control';
COMMENT ON COLUMN public.direct_message_members.channel_id IS E'@foreignKey (direct_message_channels.id) References the DM channel';
COMMENT ON COLUMN public.direct_message_members.user_id IS E'@foreignKey (auth.users.id) References the user';
COMMENT ON COLUMN public.direct_message_members.profile_id IS E'@foreignKey (profiles.id) References the user profile';

-- Create functions to handle data modifications
CREATE OR REPLACE FUNCTION insert_direct_message_member(
    p_channel_id uuid,
    p_user_id uuid,
    p_profile_id uuid,
    p_last_read_at timestamp with time zone DEFAULT now()
) RETURNS uuid AS $$
DECLARE
    new_member_id uuid;
BEGIN
    -- Check if user has access
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Insert into dm_channel_members first
    INSERT INTO public.dm_channel_members (channel_id, user_id, last_read_at)
    VALUES (p_channel_id, p_user_id, p_last_read_at)
    RETURNING id INTO new_member_id;

    -- Then insert into dm_member_profiles
    INSERT INTO public.dm_member_profiles (member_id, profile_id)
    VALUES (new_member_id, p_profile_id);

    RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_direct_message_member_last_read(
    p_member_id uuid,
    p_last_read_at timestamp with time zone
) RETURNS void AS $$
BEGIN
    -- Check if user has access
    IF NOT EXISTS (
        SELECT 1 FROM public.dm_channel_members
        WHERE id = p_member_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Update last_read_at
    UPDATE public.dm_channel_members
    SET last_read_at = p_last_read_at
    WHERE id = p_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION insert_direct_message_member TO authenticated;
GRANT EXECUTE ON FUNCTION update_direct_message_member_last_read TO authenticated; 