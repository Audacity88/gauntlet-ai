-- Drop existing delete policies
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Channel creators can delete channels" ON public.channels;

-- Drop existing policies for direct_message_attachments if they exist
DROP POLICY IF EXISTS "Users can view attachments in their DMs" ON public.direct_message_attachments;
DROP POLICY IF EXISTS "Users can add attachments to their DMs" ON public.direct_message_attachments;
DROP POLICY IF EXISTS "Message authors can delete their attachments" ON public.direct_message_attachments;

-- Create direct_message_attachments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.direct_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direct_message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_message_id ON public.direct_message_attachments(direct_message_id);

-- Enable RLS
ALTER TABLE public.direct_message_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for direct_message_attachments
CREATE POLICY "Users can view attachments in their DMs" ON public.direct_message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_message_members dm
            JOIN public.direct_messages d ON d.channel_id = dm.channel_id
            WHERE d.id = direct_message_attachments.direct_message_id
            AND dm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add attachments to their DMs" ON public.direct_message_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.direct_messages d
            WHERE d.id = direct_message_attachments.direct_message_id
            AND d.user_id = auth.uid()
        )
    );

CREATE POLICY "Message authors can delete their attachments" ON public.direct_message_attachments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.direct_messages d
            WHERE d.id = direct_message_attachments.direct_message_id
            AND d.user_id = auth.uid()
        )
    );

-- Delete policies
CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own direct messages"
  ON public.direct_messages FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM direct_message_members dm
      WHERE dm.channel_id = channel_id
      AND dm.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel creators can delete channels"
  ON public.channels FOR DELETE
  USING (auth.uid() = created_by);

-- Helper functions
CREATE OR REPLACE FUNCTION create_dm_channel(other_user_id uuid)
RETURNS uuid AS $$
DECLARE
  channel_id uuid;
  my_profile_id uuid;
  other_profile_id uuid;
BEGIN
  -- Get active profiles
  SELECT id INTO my_profile_id FROM profiles
  WHERE id IN (
    SELECT profile_id FROM channel_members WHERE user_id = auth.uid()
    UNION
    SELECT profile_id FROM direct_message_members WHERE user_id = auth.uid()
  )
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO other_profile_id FROM profiles
  WHERE id IN (
    SELECT profile_id FROM channel_members WHERE user_id = other_user_id
    UNION
    SELECT profile_id FROM direct_message_members WHERE user_id = other_user_id
  )
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if DM channel already exists
  SELECT dmc.id INTO channel_id
  FROM direct_message_channels dmc
  JOIN direct_message_members dmm1 ON dmm1.channel_id = dmc.id
  JOIN direct_message_members dmm2 ON dmm2.channel_id = dmc.id
  WHERE dmm1.user_id = auth.uid()
  AND dmm2.user_id = other_user_id
  LIMIT 1;

  -- Create new channel if it doesn't exist
  IF channel_id IS NULL THEN
    channel_id := uuid_generate_v4();
    
    INSERT INTO direct_message_channels (id, created_at, updated_at)
    VALUES (channel_id, now(), now());

    INSERT INTO direct_message_members (id, channel_id, user_id, profile_id, last_read_at, created_at)
    VALUES
      (uuid_generate_v4(), channel_id, auth.uid(), my_profile_id, now(), now()),
      (uuid_generate_v4(), channel_id, other_user_id, other_profile_id, now(), now());
  END IF;

  RETURN channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message counts
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id uuid)
RETURNS TABLE (
  channel_id uuid,
  unread_count bigint
) AS $$
BEGIN
  RETURN QUERY
  -- Channel messages
  SELECT 
    m.channel_id,
    COUNT(m.id)::bigint as unread_count
  FROM messages m
  JOIN channel_members cm ON cm.channel_id = m.channel_id
  WHERE cm.user_id = p_user_id
  AND m.inserted_at > cm.inserted_at
  GROUP BY m.channel_id
  UNION ALL
  -- Direct messages
  SELECT 
    dm.channel_id,
    COUNT(dm.id)::bigint as unread_count
  FROM direct_messages dm
  JOIN direct_message_members dmm ON dmm.channel_id = dm.channel_id
  WHERE dmm.user_id = p_user_id
  AND dm.created_at > COALESCE(dmm.last_read_at, dmm.created_at)
  GROUP BY dm.channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark DM channel as read
CREATE OR REPLACE FUNCTION mark_dm_as_read(p_channel_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE direct_message_members
  SET last_read_at = now()
  WHERE channel_id = p_channel_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dm_members_last_read ON direct_message_members (last_read_at);
CREATE INDEX IF NOT EXISTS idx_messages_inserted_at ON messages (inserted_at);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles (created_at); 