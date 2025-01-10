-- Add missing columns to messages table if they don't exist
DO $$ 
BEGIN
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN updated_at timestamp with time zone DEFAULT now();
    END IF;

    -- Add attachments column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'attachments'
    ) THEN
        ALTER TABLE messages ADD COLUMN attachments jsonb[] DEFAULT '{}';
    END IF;
END $$;

-- Update the messages trigger to maintain timestamps
CREATE OR REPLACE FUNCTION messages_trigger() RETURNS trigger AS $$
BEGIN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.inserted_at := COALESCE(NEW.inserted_at, NEW.created_at);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS messages_trigger ON messages;
CREATE TRIGGER messages_trigger
    BEFORE INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION messages_trigger();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages in channels they belong to" ON messages;

-- Add RLS policies for attachments
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Users can view messages in channels they belong to"
ON messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM channel_members 
        WHERE channel_members.channel_id = messages.channel_id 
        AND channel_members.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Add helpful comments
COMMENT ON COLUMN messages.updated_at IS 'Timestamp when the message was last updated';
COMMENT ON COLUMN messages.attachments IS 'Array of file attachments for the message'; 