-- Add message_type and attachments columns to direct_messages
ALTER TABLE public.direct_messages
    ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL;

-- Add message type constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'direct_messages_type_check' 
        AND conrelid = 'public.direct_messages'::regclass
    ) THEN
        ALTER TABLE public.direct_messages
            ADD CONSTRAINT direct_messages_type_check
            CHECK (message_type IN ('text', 'system', 'thread', 'reply', 'file'));
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_type ON public.direct_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_direct_messages_deleted_at ON public.direct_messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_direct_messages_parent_id ON public.direct_messages(parent_id);

-- Update existing messages to have a default type
UPDATE public.direct_messages SET message_type = 'text' WHERE message_type IS NULL;

-- Make message_type required after setting defaults
ALTER TABLE public.direct_messages ALTER COLUMN message_type SET NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN public.direct_messages.message_type IS 'Type of message: text, system, thread, reply, or file';
COMMENT ON COLUMN public.direct_messages.attachments IS 'Array of file attachments for the message';
COMMENT ON COLUMN public.direct_messages.metadata IS 'Additional metadata for the message';
COMMENT ON COLUMN public.direct_messages.deleted_at IS 'Timestamp when the message was soft deleted';
COMMENT ON COLUMN public.direct_messages.parent_id IS 'Reference to parent message for replies and threads';

-- Add soft delete policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Users can soft delete their own direct messages'
        AND tablename = 'direct_messages'
    ) THEN
        CREATE POLICY "Users can soft delete their own direct messages" ON public.direct_messages
            FOR UPDATE
            USING (auth.uid()::text = user_id::text)
            WITH CHECK (auth.uid()::text = user_id::text);
    END IF;
END $$;

-- Update message viewing policy to exclude deleted messages
DROP POLICY IF EXISTS "Users can view direct messages they are members of" ON public.direct_messages;
CREATE POLICY "Users can view direct messages they are members of" ON public.direct_messages
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_messages.channel_id
            AND user_id = auth.uid()
        )
    ); 