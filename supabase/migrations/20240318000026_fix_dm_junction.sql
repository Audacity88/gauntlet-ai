-- Drop existing objects
DROP TABLE IF EXISTS public.direct_message_members CASCADE;
DROP FUNCTION IF EXISTS get_user_dm_channels;

-- Create junction tables for clear relationships
CREATE TABLE public.dm_channel_members (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id uuid NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(channel_id, user_id)
);

CREATE TABLE public.dm_member_profiles (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    member_id uuid NOT NULL REFERENCES public.dm_channel_members(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(member_id, profile_id)
);

-- Create indexes
CREATE INDEX idx_dm_channel_members_channel ON public.dm_channel_members(channel_id);
CREATE INDEX idx_dm_channel_members_user ON public.dm_channel_members(user_id);
CREATE INDEX idx_dm_member_profiles_member ON public.dm_member_profiles(member_id);
CREATE INDEX idx_dm_member_profiles_profile ON public.dm_member_profiles(profile_id);

-- Enable RLS
ALTER TABLE public.dm_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_member_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can access their DM memberships"
  ON public.dm_channel_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can access DM profiles"
  ON public.dm_member_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_channel_members
      WHERE id = member_id AND user_id = auth.uid()
    )
  );

-- Create a view for easy access
CREATE OR REPLACE VIEW public.dm_members AS
SELECT 
    dcm.id as member_id,
    dcm.channel_id,
    dcm.user_id,
    dmp.profile_id,
    p.username,
    p.full_name,
    p.avatar_url,
    dcm.last_read_at,
    dcm.created_at
FROM public.dm_channel_members dcm
JOIN public.dm_member_profiles dmp ON dmp.member_id = dcm.id
JOIN public.profiles p ON p.id = dmp.profile_id;

-- Create a function to get DM channels
CREATE OR REPLACE FUNCTION get_dm_channels(p_user_id uuid)
RETURNS TABLE (
    channel_id uuid,
    member_id uuid,
    user_id uuid,
    profile_id uuid,
    username text,
    full_name text,
    last_read_at timestamp with time zone
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dm.channel_id,
        dm.member_id,
        dm.user_id,
        dm.profile_id,
        dm.username,
        dm.full_name,
        dm.last_read_at
    FROM public.dm_members dm
    WHERE dm.channel_id IN (
        SELECT channel_id 
        FROM public.dm_channel_members 
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON public.dm_channel_members TO authenticated;
GRANT SELECT ON public.dm_member_profiles TO authenticated;
GRANT SELECT ON public.dm_members TO authenticated;
GRANT EXECUTE ON FUNCTION get_dm_channels TO authenticated;

-- Add explicit comments for PostgREST
COMMENT ON TABLE public.dm_channel_members IS 'Direct message channel members';
COMMENT ON TABLE public.dm_member_profiles IS 'Profiles associated with DM channel members';
COMMENT ON COLUMN public.dm_channel_members.channel_id IS E'@foreignKey (direct_message_channels.id) References the DM channel';
COMMENT ON COLUMN public.dm_channel_members.user_id IS E'@foreignKey (auth.users.id) References the user';
COMMENT ON COLUMN public.dm_member_profiles.profile_id IS E'@foreignKey (profiles.id) References the user profile'; 