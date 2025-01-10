-- Add created_at column to messages if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN created_at timestamp with time zone;
        -- Update created_at with inserted_at values
        UPDATE messages SET created_at = inserted_at;
        -- Make created_at not null and set default
        ALTER TABLE messages ALTER COLUMN created_at SET NOT NULL;
        ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT now();
    END IF;
END $$;

-- Update the messages trigger to maintain created_at
CREATE OR REPLACE FUNCTION messages_trigger() RETURNS trigger AS $$
BEGIN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.inserted_at := COALESCE(NEW.inserted_at, now());
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

-- Update RLS policies to use created_at for ordering where appropriate
DROP POLICY IF EXISTS "Users can view messages in channels they belong to" ON messages;
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

-- Add helpful comment
COMMENT ON COLUMN messages.created_at IS 'Timestamp when the message was created, consistent with direct_messages table'; 