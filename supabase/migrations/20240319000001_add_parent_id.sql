-- Add parent_id column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) NULL;

-- Add parent_id column to direct_messages table
ALTER TABLE direct_messages 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES direct_messages(id) NULL;

-- Add indexes for better performance on thread queries
CREATE INDEX IF NOT EXISTS messages_parent_id_idx ON messages(parent_id);
CREATE INDEX IF NOT EXISTS direct_messages_parent_id_idx ON direct_messages(parent_id); 