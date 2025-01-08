-- Create channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create channel_members table
CREATE TABLE channel_members (
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (channel_id, user_id)
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create message_reactions table
CREATE TABLE message_reactions (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Create message_attachments table
CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for channels
CREATE POLICY "Channels are viewable by members" ON channels
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM channel_members WHERE channel_id = channels.id
    ) OR NOT is_private
  );

CREATE POLICY "Users can create channels" ON channels
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Channel creators can update their channels" ON channels
  FOR UPDATE USING (auth.uid() = created_by);

-- Create policies for channel_members
CREATE POLICY "Channel members are viewable by channel members" ON channel_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_members.channel_id
      AND (NOT c.is_private OR auth.uid() IN (
        SELECT cm.user_id FROM channel_members cm WHERE cm.channel_id = c.id
      ))
    )
  );

CREATE POLICY "Users can join public channels or if they are the creator" ON channel_members
  FOR INSERT WITH CHECK (
    -- Allow if user is adding themselves
    auth.uid() = user_id
    AND (
      -- To a public channel
      EXISTS (
        SELECT 1 FROM channels c
        WHERE c.id = channel_members.channel_id
        AND NOT c.is_private
      )
      OR
      -- Or if they created the channel
      EXISTS (
        SELECT 1 FROM channels c
        WHERE c.id = channel_members.channel_id
        AND c.created_by = auth.uid()
      )
    )
  );

-- Create policies for messages
CREATE POLICY "Messages are viewable by channel members" ON messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM channel_members WHERE channel_id = messages.channel_id
    )
  );

CREATE POLICY "Channel members can insert messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM channel_members WHERE channel_id = messages.channel_id
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Message authors can update their messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for message_reactions
CREATE POLICY "Reactions are viewable by channel members" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channel_members cm ON m.channel_id = cm.channel_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel members can react to messages" ON message_reactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channel_members cm ON m.channel_id = cm.channel_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

-- Create policies for message_attachments
CREATE POLICY "Attachments are viewable by channel members" ON message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channel_members cm ON m.channel_id = cm.channel_id
      WHERE m.id = message_attachments.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Message authors can attach files" ON message_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND m.user_id = auth.uid()
    )
  );

-- Enable Realtime for messages and reactions
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
``` 