-- Create a compatibility view for the old table name
CREATE OR REPLACE VIEW public.direct_message_members AS
SELECT 
    dcm.id,
    dcm.channel_id,
    dcm.user_id,
    dmp.profile_id,
    dcm.last_read_at,
    dcm.created_at
FROM public.dm_channel_members dcm
LEFT JOIN public.dm_member_profiles dmp ON dmp.member_id = dcm.id;

-- Grant access to the compatibility view
GRANT SELECT ON public.direct_message_members TO authenticated;

-- Add explicit comments for PostgREST on the compatibility view
COMMENT ON VIEW public.direct_message_members IS 'Compatibility view for direct message members';
COMMENT ON COLUMN public.direct_message_members.channel_id IS E'@foreignKey (direct_message_channels.id) References the DM channel';
COMMENT ON COLUMN public.direct_message_members.user_id IS E'@foreignKey (auth.users.id) References the user';
COMMENT ON COLUMN public.direct_message_members.profile_id IS E'@foreignKey (profiles.id) References the user profile';

-- Create a policy for the compatibility view
CREATE POLICY "Users can access DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

-- Create a function to handle inserts to the compatibility view
CREATE OR REPLACE FUNCTION insert_direct_message_member()
RETURNS TRIGGER AS $$
DECLARE
    new_member_id uuid;
BEGIN
    -- Insert into dm_channel_members first
    INSERT INTO public.dm_channel_members (channel_id, user_id, last_read_at, created_at)
    VALUES (NEW.channel_id, NEW.user_id, NEW.last_read_at, NEW.created_at)
    RETURNING id INTO new_member_id;

    -- Then insert into dm_member_profiles
    INSERT INTO public.dm_member_profiles (member_id, profile_id)
    VALUES (new_member_id, NEW.profile_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the compatibility view
CREATE TRIGGER insert_direct_message_member_trigger
    INSTEAD OF INSERT ON public.direct_message_members
    FOR EACH ROW
    EXECUTE FUNCTION insert_direct_message_member();

-- Create a function to handle updates to the compatibility view
CREATE OR REPLACE FUNCTION update_direct_message_member()
RETURNS TRIGGER AS $$
BEGIN
    -- Update dm_channel_members
    UPDATE public.dm_channel_members
    SET last_read_at = NEW.last_read_at
    WHERE id = OLD.id;

    -- Update dm_member_profiles if profile_id changed
    IF NEW.profile_id != OLD.profile_id THEN
        UPDATE public.dm_member_profiles
        SET profile_id = NEW.profile_id
        WHERE member_id = OLD.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
CREATE TRIGGER update_direct_message_member_trigger
    INSTEAD OF UPDATE ON public.direct_message_members
    FOR EACH ROW
    EXECUTE FUNCTION update_direct_message_member(); 