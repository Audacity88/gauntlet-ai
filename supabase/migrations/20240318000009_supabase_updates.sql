-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper Functions

-- Create a DM channel between two users
CREATE OR REPLACE FUNCTION create_dm_channel(user1_id uuid, user2_id uuid, profile1_id uuid, profile2_id uuid)
RETURNS uuid AS $$
DECLARE
    channel_id uuid;
BEGIN
    -- Create DM channel
    INSERT INTO direct_message_channels (id, created_at, updated_at)
    VALUES (uuid_generate_v4(), now(), now())
    RETURNING id INTO channel_id;

    -- Add both users as members
    INSERT INTO direct_message_members (id, channel_id, user_id, profile_id, last_read_at, created_at)
    VALUES
        (uuid_generate_v4(), channel_id, user1_id, profile1_id, now(), now()),
        (uuid_generate_v4(), channel_id, user2_id, profile2_id, now(), now());

    RETURN channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create DM channel between two users
CREATE OR REPLACE FUNCTION get_or_create_dm_channel(user1_id uuid, user2_id uuid, profile1_id uuid, profile2_id uuid)
RETURNS uuid AS $$
DECLARE
    existing_channel_id uuid;
BEGIN
    -- Check if DM channel already exists
    SELECT dm1.channel_id INTO existing_channel_id
    FROM direct_message_members dm1
    JOIN direct_message_members dm2 ON dm1.channel_id = dm2.channel_id
    WHERE dm1.user_id = user1_id AND dm2.user_id = user2_id;

    -- If channel exists, return it
    IF existing_channel_id IS NOT NULL THEN
        RETURN existing_channel_id;
    END IF;

    -- Otherwise create new channel
    RETURN create_dm_channel(user1_id, user2_id, profile1_id, profile2_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update last read timestamp for DM channel
CREATE OR REPLACE FUNCTION update_dm_last_read(channel_id uuid, user_id uuid)
RETURNS timestamp with time zone AS $$
DECLARE
    new_timestamp timestamp with time zone;
BEGIN
    UPDATE direct_message_members
    SET last_read_at = now()
    WHERE channel_id = $1 AND user_id = $2
    RETURNING last_read_at INTO new_timestamp;

    RETURN new_timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread message count for DM channel
CREATE OR REPLACE FUNCTION get_dm_unread_count(channel_id uuid, user_id uuid)
RETURNS bigint AS $$
    SELECT COUNT(*)
    FROM direct_messages m
    JOIN direct_message_members dmm ON dmm.channel_id = m.channel_id
    WHERE m.channel_id = $1
    AND dmm.user_id = $2
    AND m.created_at > dmm.last_read_at;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get user's active channels with latest message
CREATE OR REPLACE FUNCTION get_user_channels(user_id uuid)
RETURNS TABLE (
    channel_id uuid,
    channel_type text,
    latest_message_at timestamp with time zone,
    unread_count bigint
) AS $$
BEGIN
    RETURN QUERY
    -- Get regular channels
    SELECT 
        c.id,
        'channel'::text as channel_type,
        MAX(m.inserted_at) as latest_message_at,
        COUNT(m.id) FILTER (WHERE m.inserted_at > cm.inserted_at) as unread_count
    FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    LEFT JOIN messages m ON m.channel_id = c.id
    WHERE cm.user_id = $1
    GROUP BY c.id
    
    UNION ALL
    
    -- Get DM channels
    SELECT 
        dmc.id,
        'dm'::text as channel_type,
        MAX(dm.created_at) as latest_message_at,
        COUNT(dm.id) FILTER (WHERE dm.created_at > dmm.last_read_at) as unread_count
    FROM direct_message_channels dmc
    JOIN direct_message_members dmm ON dmm.channel_id = dmc.id
    LEFT JOIN direct_messages dm ON dm.channel_id = dmc.id
    WHERE dmm.user_id = $1
    GROUP BY dmc.id
    
    ORDER BY latest_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update or create functions for handling messages
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    uuid_generate_v4(),
    'user_' || substr(NEW.id::text, 1, 8)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for creating default profile when a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get user's active profile
CREATE OR REPLACE FUNCTION get_active_profile(p_user_id uuid)
RETURNS uuid AS $$
  SELECT id FROM profiles
  WHERE id IN (
    SELECT profile_id FROM channel_members WHERE user_id = p_user_id
    UNION
    SELECT profile_id FROM direct_message_members WHERE user_id = p_user_id
  )
  ORDER BY created_at DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their DM channels" ON public.direct_message_channels;
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update their last read timestamp" ON public.direct_message_members;
DROP POLICY IF EXISTS "Channels are viewable by members" ON public.channels;
DROP POLICY IF EXISTS "Users can create channels" ON public.channels;
DROP POLICY IF EXISTS "Channel members are viewable by channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can join public channels" ON public.channel_members;
DROP POLICY IF EXISTS "Messages are viewable by channel members" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their channels" ON public.messages;
DROP POLICY IF EXISTS "Users can view their direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Message attachments are accessible by channel members" ON storage.objects;
DROP POLICY IF EXISTS "DM attachments are accessible by participants" ON storage.objects;

-- RLS Policies

-- Profiles policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM channel_members WHERE profile_id = id AND user_id = auth.uid()
      UNION
      SELECT 1 FROM direct_message_members WHERE profile_id = id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members WHERE profile_id = id AND user_id = auth.uid()
      UNION
      SELECT 1 FROM direct_message_members WHERE profile_id = id AND user_id = auth.uid()
    )
  );

-- Direct Message Channels policies
ALTER TABLE public.direct_message_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DM channels"
  ON public.direct_message_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_message_members
      WHERE direct_message_members.channel_id = id
      AND direct_message_members.user_id = auth.uid()
    )
  );

-- Direct Message Members policies
ALTER TABLE public.direct_message_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their last read timestamp"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Channels policies
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channels are viewable by members"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create channels"
  ON public.channels FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Channel members policies
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channel members are viewable by channel members"
  ON public.channel_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join public channels"
  ON public.channel_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND profile_id IN (
      SELECT p.id FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.profile_id = p.id AND cm.user_id = auth.uid()
      )
    )
  );

-- Messages policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages are viewable by channel members"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their channels"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND profile_id IN (
      SELECT p.id FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.profile_id = p.id AND cm.user_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

-- Direct messages policies
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their direct messages"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM direct_message_members dm
      WHERE dm.channel_id = channel_id
      AND dm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND profile_id IN (
      SELECT p.id FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM direct_message_members dm
        WHERE dm.profile_id = p.id AND dm.user_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM direct_message_members dm
      WHERE dm.channel_id = channel_id
      AND dm.user_id = auth.uid()
    )
  );

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.profile_id = p.id AND cm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Message attachments are accessible by channel members"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id::text = (storage.foldername(name))[1]
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "DM attachments are accessible by participants"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM direct_messages dm
      JOIN direct_message_members dmm ON dmm.channel_id = dm.channel_id
      WHERE dm.id::text = (storage.foldername(name))[1]
      AND dmm.user_id = auth.uid()
    )
  ); 