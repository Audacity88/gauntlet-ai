-- Add sender and receiver foreign key relationships to direct_messages table
ALTER TABLE direct_messages
ADD COLUMN sender_id UUID REFERENCES profiles(id),
ADD COLUMN receiver_id UUID REFERENCES profiles(id);

-- Add foreign key constraints
ALTER TABLE direct_messages
ADD CONSTRAINT direct_messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

ALTER TABLE direct_messages
ADD CONSTRAINT direct_messages_receiver_id_fkey 
FOREIGN KEY (receiver_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Update the direct_message_members table to properly reference profiles
ALTER TABLE direct_message_members
ADD CONSTRAINT direct_message_members_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE; 