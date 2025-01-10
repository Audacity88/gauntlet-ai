-- Drop existing policies and views
DROP POLICY IF EXISTS "Users can view DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update DM memberships" ON public.direct_message_members;
DROP VIEW IF EXISTS public.dm_member_profiles;

-- Create a function to get a user's DM channel IDs
CREATE OR REPLACE FUNCTION get_user_dm_channels(user_uuid uuid)
RETURNS TABLE (channel_id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT dmm.channel_id
    FROM public.direct_message_members dmm
    WHERE dmm.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for DM member details
CREATE OR REPLACE VIEW public.dm_member_details AS
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

-- Create simple policies without recursion
CREATE POLICY "Users can view own DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view DM channel members"
  ON public.direct_message_members FOR SELECT
  USING (channel_id IN (SELECT get_user_dm_channels(auth.uid())));

-- Grant necessary permissions
GRANT SELECT ON public.dm_member_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dm_channels TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON VIEW public.dm_member_details IS 'Direct message members with their associated profiles';
COMMENT ON COLUMN public.dm_member_details.profile_id IS E'@foreignKey (profiles.id)';
COMMENT ON COLUMN public.dm_member_details.channel_id IS E'@foreignKey (direct_message_channels.id)'; 