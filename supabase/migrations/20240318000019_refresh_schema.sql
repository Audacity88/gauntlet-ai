-- Drop and recreate the direct_message_members table to ensure clean schema
DROP TABLE IF EXISTS public.direct_message_members CASCADE;

CREATE TABLE public.direct_message_members (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id uuid NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(channel_id, user_id)
);

-- Enable RLS
ALTER TABLE public.direct_message_members ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_dm_members_channel_id ON public.direct_message_members(channel_id);
CREATE INDEX idx_dm_members_user_id ON public.direct_message_members(user_id);
CREATE INDEX idx_dm_members_profile_id ON public.direct_message_members(profile_id);

-- Create the view with explicit joins
CREATE OR REPLACE VIEW public.direct_message_member_details AS
SELECT 
    dmm.id,
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
JOIN public.direct_message_channels dmc ON dmc.id = dmm.channel_id
JOIN public.profiles p ON p.id = dmm.profile_id;

-- Grant necessary permissions
GRANT SELECT ON public.direct_message_member_details TO authenticated;
GRANT ALL ON public.direct_message_members TO authenticated;

-- Create policies
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

CREATE POLICY "Users can update DM memberships"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Comment on table and columns to help PostgREST
COMMENT ON TABLE public.direct_message_members IS 'Direct message channel members with profile and user associations';
COMMENT ON COLUMN public.direct_message_members.channel_id IS 'References direct_message_channels(id)';
COMMENT ON COLUMN public.direct_message_members.user_id IS 'References auth.users(id)';
COMMENT ON COLUMN public.direct_message_members.profile_id IS 'References profiles(id)'; 