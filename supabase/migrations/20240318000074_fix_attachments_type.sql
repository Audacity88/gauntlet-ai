-- Drop existing attachments column from messages table
ALTER TABLE messages DROP COLUMN IF EXISTS attachments;

-- Add attachments column with correct type
ALTER TABLE messages ADD COLUMN attachments JSONB DEFAULT '[]';

-- Drop existing attachments column from direct_messages table
ALTER TABLE direct_messages DROP COLUMN IF EXISTS attachments;

-- Add attachments column with correct type
ALTER TABLE direct_messages ADD COLUMN attachments JSONB DEFAULT '[]';

-- Add helpful comments
COMMENT ON COLUMN messages.attachments IS 'JSONB array of file attachments for the message';
COMMENT ON COLUMN direct_messages.attachments IS 'JSONB array of file attachments for the direct message'; 