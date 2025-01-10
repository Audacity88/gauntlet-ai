-- Drop existing function if it exists
DROP FUNCTION IF EXISTS send_direct_message;

-- Recreate function with correct signature
CREATE OR REPLACE FUNCTION send_direct_message(
  p_channel_id UUID,
  p_user_id UUID,
  p_profile_id UUID,
  p_content TEXT
) RETURNS direct_messages AS $$
DECLARE
  v_message direct_messages;
BEGIN
  -- Insert the message
  INSERT INTO direct_messages (
    channel_id,
    user_id,
    profile_id,
    content
  ) VALUES (
    p_channel_id,
    p_user_id,
    p_profile_id,
    p_content
  )
  RETURNING * INTO v_message;

  -- Update channel timestamp
  UPDATE direct_message_channels
  SET updated_at = NOW()
  WHERE id = p_channel_id;

  RETURN v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_direct_message(UUID, UUID, UUID, TEXT) TO authenticated;

-- Add explicit comment for PostgREST
COMMENT ON FUNCTION send_direct_message(UUID, UUID, UUID, TEXT) IS 'Sends a direct message and updates the channel timestamp with parameters in order: p_channel_id, p_user_id, p_profile_id, p_content'; 