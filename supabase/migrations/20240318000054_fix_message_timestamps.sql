-- Add created_at column to messages if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN created_at timestamp with time zone DEFAULT now();
        -- Update created_at with inserted_at values for existing messages
        UPDATE messages SET created_at = inserted_at WHERE created_at IS NULL;
        -- Make created_at not null
        ALTER TABLE messages ALTER COLUMN created_at SET NOT NULL;
    END IF;
END $$;

-- Update the messages trigger to maintain created_at
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

-- Add helpful comment
COMMENT ON COLUMN messages.created_at IS 'Timestamp when the message was created, consistent with direct_messages table'; 