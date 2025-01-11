DROP FUNCTION update_message_with_attachment(uuid,jsonb);
DROP FUNCTION update_dm_with_attachment(uuid,jsonb);

-- Function to update message with attachment for channels
CREATE OR REPLACE FUNCTION update_message_with_attachment(
    p_message_id UUID,
    p_attachments JSONB
)
RETURNS TABLE (
    id UUID,
    channel_id UUID,
    user_id UUID,
    content TEXT,
    attachments JSONB,
    inserted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    UPDATE messages m
    SET 
        attachments = p_attachments,
        updated_at = NOW()
    WHERE m.id = p_message_id
    RETURNING 
        m.id,
        m.channel_id,
        m.user_id,
        m.content,
        m.attachments,
        m.inserted_at,
        m.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update direct message with attachment
CREATE OR REPLACE FUNCTION update_dm_with_attachment(
    p_message_id UUID,
    p_attachments JSONB
)
RETURNS TABLE (
    id UUID,
    channel_id UUID,
    user_id UUID,
    profile_id UUID,
    content TEXT,
    attachments JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    UPDATE direct_messages dm
    SET 
        attachments = p_attachments,
        updated_at = NOW()
    WHERE dm.id = p_message_id
    RETURNING 
        dm.id,
        dm.channel_id,
        dm.user_id,
        dm.profile_id,
        dm.content,
        dm.attachments,
        dm.created_at,
        dm.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable row level security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for message updates
DO $$ 
BEGIN
    DROP POLICY IF EXISTS update_message ON messages;
    CREATE POLICY update_message ON messages
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid());
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create policy for direct message updates
DO $$ 
BEGIN
    DROP POLICY IF EXISTS update_dm ON direct_messages;
    CREATE POLICY update_dm ON direct_messages
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM dm_channel_members dcm
            WHERE dcm.channel_id = direct_messages.channel_id
            AND dcm.user_id = auth.uid()
        ));
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;