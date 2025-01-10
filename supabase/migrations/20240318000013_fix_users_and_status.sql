-- Create status table
CREATE TABLE IF NOT EXISTS public.user_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'offline',
    last_seen timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update their last read timestamp" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can view DM channels" ON public.direct_message_channels;

-- Create view for user data
CREATE OR REPLACE VIEW public.users AS
SELECT 
    au.id,
    au.email,
    p.username,
    p.full_name,
    us.status,
    us.last_seen
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_status us ON us.user_id = au.id;

-- Fix DM policies
CREATE POLICY "Users can view their DM channels"
  ON public.direct_message_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_message_members
      WHERE channel_id = id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR channel_id IN (
      SELECT channel_id 
      FROM direct_message_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their last read timestamp"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Status policies
CREATE POLICY "Users can view all statuses"
  ON public.user_status FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own status"
  ON public.user_status FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own status"
  ON public.user_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Enable RLS
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY; 