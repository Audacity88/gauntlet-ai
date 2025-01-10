-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can join public channels" ON public.channel_members;
DROP POLICY IF EXISTS "Users can insert messages in their channels" ON public.messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;

-- Fix foreign key relationship for channels
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_created_by_fkey;
ALTER TABLE public.channels ADD CONSTRAINT channels_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create new policies without circular dependencies
CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can join public channels"
  ON public.channel_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
      AND p.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their channels"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = messages.channel_id
      AND cm.user_id = auth.uid()
      AND cm.profile_id = messages.profile_id
    )
  );

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM direct_message_members dm
      WHERE dm.channel_id = channel_id
      AND dm.user_id = auth.uid()
      AND dm.profile_id = profile_id
    )
  );

-- Fix DM member policies to avoid recursion
CREATE POLICY "Users can view their DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM direct_message_members dm2
      WHERE dm2.channel_id = channel_id
      AND dm2.user_id = auth.uid()
    )
  ); 