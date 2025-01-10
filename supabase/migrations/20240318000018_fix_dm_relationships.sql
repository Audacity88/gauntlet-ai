-- Drop existing constraints if they exist
ALTER TABLE public.direct_message_members 
    DROP CONSTRAINT IF EXISTS direct_message_members_profile_id_fkey,
    DROP CONSTRAINT IF EXISTS direct_message_members_user_id_fkey,
    DROP CONSTRAINT IF EXISTS direct_message_members_channel_id_fkey;

-- Add foreign key constraints
ALTER TABLE public.direct_message_members
    ADD CONSTRAINT direct_message_members_profile_id_fkey 
        FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    ADD CONSTRAINT direct_message_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD CONSTRAINT direct_message_members_channel_id_fkey 
        FOREIGN KEY (channel_id) REFERENCES public.direct_message_channels(id) ON DELETE CASCADE;

-- Create a view to expose DM member details
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
    p.avatar_url
FROM public.direct_message_members dmm
LEFT JOIN public.profiles p ON p.id = dmm.profile_id;

-- Grant access to the view
GRANT SELECT ON public.direct_message_member_details TO authenticated;

-- Update DM member policies to include profile access
DROP POLICY IF EXISTS "Users can view DM memberships" ON public.direct_message_members;
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