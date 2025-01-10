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

-- Function to send a DM and update channel timestamp in one transaction
CREATE OR REPLACE FUNCTION send_direct_message(
  p_channel_id UUID,
  p_user_id UUID,
  p_profile_id UUID,
  p_content TEXT
) RETURNS direct_messages AS $$
DECLARE
  v_message direct_messages;
BEGIN
  -- Insert the message
  INSERT INTO direct_messages (
    channel_id,
    user_id,
    profile_id,
    content
  ) VALUES (
    p_channel_id,
    p_user_id,
    p_profile_id,
    p_content
  )
  RETURNING * INTO v_message;

  -- Update channel timestamp
  UPDATE direct_message_channels
  SET updated_at = NOW()
  WHERE id = p_channel_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_inserted_at ON messages (inserted_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_id ON direct_messages (channel_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_user_id ON direct_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_message_members_channel_user ON direct_message_members (channel_id, user_id);
CREATE INDEX IF NOT EXISTS idx_direct_message_members_user_id ON direct_message_members (user_id);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_message_channels ENABLE ROW LEVEL SECURITY; 