-- Drop all DM-related policies
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update their last read timestamp" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can view DM channels" ON public.direct_message_channels;
DROP POLICY IF EXISTS "Users can view their direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;

-- Simple DM channel policy
CREATE POLICY "Users can view DM channels"
  ON public.direct_message_channels FOR SELECT
  USING (
    id IN (
      SELECT channel_id
      FROM direct_message_members
      WHERE user_id = auth.uid()
    )
  );

-- Simple DM member policies
CREATE POLICY "Users can view DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update DM memberships"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Simple DM message policies
CREATE POLICY "Users can view direct messages"
  ON public.direct_messages FOR SELECT
  USING (
    channel_id IN (
      SELECT channel_id
      FROM direct_message_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND channel_id IN (
      SELECT channel_id
      FROM direct_message_members
      WHERE user_id = auth.uid()
    )
  ); 