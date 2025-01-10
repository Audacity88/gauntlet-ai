-- Drop existing policies and views
DROP POLICY IF EXISTS "Users can view their own DM memberships" ON public.direct_message_members;
DROP VIEW IF EXISTS public.dm_member_profiles;

-- Create a secure view that includes access control in the view definition
CREATE OR REPLACE VIEW public.dm_member_profiles AS
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
LEFT JOIN public.direct_message_channels dmc ON dmc.id = dmm.channel_id
WHERE dmm.user_id = auth.uid()
   OR dmm.channel_id IN (
      SELECT channel_id
      FROM public.direct_message_members
      WHERE user_id = auth.uid()
   );

-- Grant access to the view
GRANT SELECT ON public.dm_member_profiles TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON VIEW public.dm_member_profiles IS 'Direct message members with their associated profiles';
COMMENT ON COLUMN public.dm_member_profiles.profile_id IS E'@foreignKey (profiles.id)';
COMMENT ON COLUMN public.dm_member_profiles.channel_id IS E'@foreignKey (direct_message_channels.id)';

-- Create simple policy for the base table
CREATE POLICY "Users can view DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR channel_id IN (
      SELECT channel_id
      FROM direct_message_members
      WHERE user_id = auth.uid()
    )
  ); 