-- Drop all existing member-related policies
DROP POLICY IF EXISTS "Channel members are viewable by channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can join public channels" ON public.channel_members;
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update their last read timestamp" ON public.direct_message_members;

-- Channel member policies
CREATE POLICY "Channel members are viewable by channel members"
  ON public.channel_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can join public channels"
  ON public.channel_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND profile_id IN (
      SELECT id FROM profiles WHERE id = auth.uid()
    )
  );

-- Direct message member policies
CREATE POLICY "Users can view their DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their last read timestamp"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Channel policies
DROP POLICY IF EXISTS "Channels are viewable by members" ON public.channels;
CREATE POLICY "Channels are viewable by members"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = id
      AND channel_members.user_id = auth.uid()
    )
  );

-- Profile policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Message policies
DROP POLICY IF EXISTS "Messages are viewable by channel members" ON public.messages;
CREATE POLICY "Messages are viewable by channel members"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_id
      AND channel_members.user_id = auth.uid()
    )
  ); 