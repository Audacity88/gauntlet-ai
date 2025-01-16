-- Update messages table to add new fields
ALTER TABLE public.messages
    ADD COLUMN message_type TEXT,
    ADD COLUMN parent_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add index for parent_id for better query performance on threaded messages
CREATE INDEX idx_messages_parent_id ON public.messages(parent_id);

-- Add index for message_type for filtering
CREATE INDEX idx_messages_type ON public.messages(message_type);

-- Add index for soft deletes
CREATE INDEX idx_messages_deleted_at ON public.messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_messages_updated_at();

-- Update direct_messages table to match the schema
ALTER TABLE public.direct_messages
    ADD COLUMN message_type TEXT,
    ADD COLUMN parent_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
    ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add indexes for direct_messages
CREATE INDEX idx_direct_messages_parent_id ON public.direct_messages(parent_id);
CREATE INDEX idx_direct_messages_type ON public.direct_messages(message_type);
CREATE INDEX idx_direct_messages_deleted_at ON public.direct_messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create a trigger for direct_messages updated_at
CREATE OR REPLACE FUNCTION public.update_direct_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER direct_messages_updated_at
    BEFORE UPDATE ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_direct_messages_updated_at();

-- Add message type constraints
ALTER TABLE public.messages
    ADD CONSTRAINT messages_type_check
    CHECK (message_type IN ('text', 'system', 'thread', 'reply', 'file'));

ALTER TABLE public.direct_messages
    ADD CONSTRAINT direct_messages_type_check
    CHECK (message_type IN ('text', 'system', 'thread', 'reply', 'file'));

-- Update existing messages to have a default type
UPDATE public.messages SET message_type = 'text' WHERE message_type IS NULL;
UPDATE public.direct_messages SET message_type = 'text' WHERE message_type IS NULL;

-- Make message_type required after setting defaults
ALTER TABLE public.messages ALTER COLUMN message_type SET NOT NULL;
ALTER TABLE public.direct_messages ALTER COLUMN message_type SET NOT NULL;

-- Add policies for soft delete
CREATE POLICY "Users can soft delete their own messages" ON public.messages
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (
        auth.uid()::text = user_id::text
        AND NEW.deleted_at IS NOT NULL
        AND OLD.deleted_at IS NULL
    );

CREATE POLICY "Users can soft delete their own direct messages" ON public.direct_messages
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (
        auth.uid()::text = user_id::text
        AND NEW.deleted_at IS NOT NULL
        AND OLD.deleted_at IS NULL
    );

-- Update message viewing policies to exclude deleted messages
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages" ON public.messages
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM public.channel_members
            WHERE channel_id = messages.channel_id
            AND user_id = auth.uid()
        )
    );

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

-- Add comment to explain message types
COMMENT ON COLUMN public.messages.message_type IS 'Type of message: text, system, thread, reply, or file';
COMMENT ON COLUMN public.direct_messages.message_type IS 'Type of message: text, system, thread, reply, or file'; 