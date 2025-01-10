-- Function to update a direct message with attachments
CREATE OR REPLACE FUNCTION update_dm_with_attachment(
  p_message_id UUID,
  p_attachments JSONB
) RETURNS direct_messages AS $$
DECLARE
  v_message direct_messages;
BEGIN
  -- Verify the user owns the message
  IF NOT EXISTS (
    SELECT 1 FROM direct_messages
    WHERE id = p_message_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Message not found or not owned by user';
  END IF;

  -- Update the message
  UPDATE direct_messages
  SET 
    attachments = p_attachments,
    updated_at = NOW()
  WHERE id = p_message_id
  AND user_id = auth.uid()
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update a regular message with attachments
CREATE OR REPLACE FUNCTION update_message_with_attachment(
  p_message_id UUID,
  p_attachments JSONB
) RETURNS messages AS $$
DECLARE
  v_message messages;
BEGIN
  -- Verify the user owns the message
  IF NOT EXISTS (
    SELECT 1 FROM messages
    WHERE id = p_message_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Message not found or not owned by user';
  END IF;

  -- Update the message
  UPDATE messages
  SET 
    attachments = p_attachments,
    updated_at = NOW()
  WHERE id = p_message_id
  AND user_id = auth.uid()
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_dm_with_attachment TO authenticated;
GRANT EXECUTE ON FUNCTION update_message_with_attachment TO authenticated; 