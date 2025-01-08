-- Create direct_message_channels table
CREATE TABLE direct_message_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create direct_message_members table
CREATE TABLE direct_message_members (
  channel_id UUID REFERENCES direct_message_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (channel_id, user_id)
);

-- Create direct_messages table
CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES direct_message_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for direct_message_channels
CREATE POLICY "Users can view their DM channels" ON direct_message_channels
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM direct_message_members WHERE channel_id = id
    )
  );

CREATE POLICY "Users can create DM channels" ON direct_message_channels
  FOR INSERT WITH CHECK (true);

-- Create policies for direct_message_members
CREATE POLICY "Users can view DM members" ON direct_message_members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM direct_message_members WHERE channel_id = channel_id
    )
  );

CREATE POLICY "Users can add DM members" ON direct_message_members
  FOR INSERT WITH CHECK (true);

-- Create policies for direct_messages
CREATE POLICY "Users can view messages in their DMs" ON direct_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM direct_message_members WHERE channel_id = channel_id
    )
  );

CREATE POLICY "Users can send messages to their DMs" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() IN (
      SELECT user_id FROM direct_message_members WHERE channel_id = channel_id
    )
  );

CREATE POLICY "Message authors can update their DMs" ON direct_messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_direct_message_channels_updated_at
  BEFORE UPDATE ON direct_message_channels
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_direct_messages_updated_at
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE direct_message_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages; 