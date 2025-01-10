-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_message_with_attachment;

-- Create function to update message with attachment
CREATE OR REPLACE FUNCTION update_message_with_attachment(
  p_message_id UUID,
  p_attachments JSONB,
  p_is_dm BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_message JSONB;
BEGIN
  -- Verify the user owns the message
  IF p_is_dm THEN
    IF NOT EXISTS (
      SELECT 1 FROM direct_messages
      WHERE id = p_message_id
      AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Message not found or not owned by user';
    END IF;

    -- Update the direct message with the new attachments
    UPDATE direct_messages
    SET 
      attachments = p_attachments,
      updated_at = NOW()
    WHERE id = p_message_id
    RETURNING to_jsonb(direct_messages.*) INTO v_message;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM messages
      WHERE id = p_message_id
      AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Message not found or not owned by user';
    END IF;

    -- Update the channel message with the new attachments
    UPDATE messages
    SET 
      attachments = p_attachments,
      updated_at = NOW()
    WHERE id = p_message_id
    RETURNING to_jsonb(messages.*) INTO v_message;
  END IF;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_message_with_attachment TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION update_message_with_attachment IS 'Updates a message with new attachments. Only the message owner can update.';