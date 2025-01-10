-- Drop existing constraints and policies
DROP POLICY IF EXISTS "Users can access DM memberships" ON public.direct_message_members;
ALTER TABLE public.direct_message_members 
    DROP CONSTRAINT IF EXISTS direct_message_members_profile_id_fkey,
    DROP CONSTRAINT IF EXISTS direct_message_members_user_id_fkey,
    DROP CONSTRAINT IF EXISTS direct_message_members_channel_id_fkey;

-- Recreate the table with explicit constraints
CREATE TABLE IF NOT EXISTS public.direct_message_members_new (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id uuid NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Copy data if table exists
INSERT INTO public.direct_message_members_new
SELECT * FROM public.direct_message_members;

-- Drop old table and rename new one
DROP TABLE IF EXISTS public.direct_message_members CASCADE;
ALTER TABLE public.direct_message_members_new RENAME TO direct_message_members;

-- Create indexes
CREATE INDEX idx_dm_members_channel ON public.direct_message_members(channel_id);
CREATE INDEX idx_dm_members_user ON public.direct_message_members(user_id);
CREATE INDEX idx_dm_members_profile ON public.direct_message_members(profile_id);
CREATE UNIQUE INDEX idx_dm_members_channel_user ON public.direct_message_members(channel_id, user_id);

-- Enable RLS
ALTER TABLE public.direct_message_members ENABLE ROW LEVEL SECURITY;

-- Create simple policy
CREATE POLICY "Users can access DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

-- Add explicit comments for PostgREST
COMMENT ON TABLE public.direct_message_members IS 'Direct message channel members';
COMMENT ON COLUMN public.direct_message_members.channel_id IS E'@foreignKey (direct_message_channels.id) References the DM channel';
COMMENT ON COLUMN public.direct_message_members.user_id IS E'@foreignKey (auth.users.id) References the user';
COMMENT ON COLUMN public.direct_message_members.profile_id IS E'@foreignKey (profiles.id) References the user profile';

-- Create a function to get DM channels
CREATE OR REPLACE FUNCTION get_user_dm_channels(p_user_id uuid)
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
        dmm.channel_id,
        dmm.id as member_id,
        dmm.user_id,
        dmm.profile_id,
        p.username,
        p.full_name,
        dmm.last_read_at
    FROM public.direct_message_members dmm
    JOIN public.profiles p ON p.id = dmm.profile_id
    WHERE dmm.channel_id IN (
        SELECT channel_id 
        FROM public.direct_message_members 
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON public.direct_message_members TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dm_channels TO authenticated; 