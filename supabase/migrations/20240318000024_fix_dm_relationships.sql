-- Drop existing objects
DROP POLICY IF EXISTS "Users can view own DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can view DM channel members" ON public.direct_message_members;
DROP VIEW IF EXISTS public.dm_member_details;
DROP MATERIALIZED VIEW IF EXISTS public.dm_member_profiles;

-- Create a materialized view with explicit foreign key constraints
CREATE MATERIALIZED VIEW public.dm_member_profiles AS
SELECT 
    dmm.id as member_id,
    dmm.channel_id,
    dmm.user_id,
    dmm.profile_id,
    dmm.last_read_at,
    dmm.created_at,
    p.username,
    p.full_name,
    p.avatar_url,
    dmc.created_at as channel_created_at
FROM public.direct_message_members dmm
LEFT JOIN public.profiles p ON p.id = dmm.profile_id
LEFT JOIN public.direct_message_channels dmc ON dmc.id = dmm.channel_id;

-- Create unique index for the materialized view
CREATE UNIQUE INDEX dm_member_profiles_pkey ON public.dm_member_profiles (member_id);
CREATE INDEX dm_member_profiles_channel_id_idx ON public.dm_member_profiles (channel_id);
CREATE INDEX dm_member_profiles_user_id_idx ON public.dm_member_profiles (user_id);
CREATE INDEX dm_member_profiles_profile_id_idx ON public.dm_member_profiles (profile_id);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dm_member_profiles()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.dm_member_profiles;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_dm_member_profiles_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON public.direct_message_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_dm_member_profiles();

-- Create a simple policy for the base table
CREATE POLICY "Users can access DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT SELECT ON public.dm_member_profiles TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON MATERIALIZED VIEW public.dm_member_profiles IS 'Direct message members with their associated profiles';
COMMENT ON COLUMN public.dm_member_profiles.profile_id IS E'@foreignKey (profiles.id) Refers to the user profile';
COMMENT ON COLUMN public.dm_member_profiles.channel_id IS E'@foreignKey (direct_message_channels.id) Refers to the DM channel';

-- Create a function to get DM channels for a user
CREATE OR REPLACE FUNCTION get_dm_channels_for_user(user_uuid uuid)
RETURNS TABLE (
    channel_id uuid,
    other_user_id uuid,
    other_profile_id uuid,
    other_username text,
    other_full_name text,
    last_read_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dmp.channel_id,
        other.user_id as other_user_id,
        other.profile_id as other_profile_id,
        other.username as other_username,
        other.full_name as other_full_name,
        dmp.last_read_at
    FROM public.dm_member_profiles dmp
    JOIN public.dm_member_profiles other ON dmp.channel_id = other.channel_id
    WHERE dmp.user_id = user_uuid
    AND other.user_id != user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_dm_channels_for_user TO authenticated; 