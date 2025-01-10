-- Grant execute permission on send_direct_message function
GRANT EXECUTE ON FUNCTION send_direct_message(UUID, UUID, UUID, TEXT) TO authenticated;

-- Add explicit comment for PostgREST
COMMENT ON FUNCTION send_direct_message(UUID, UUID, UUID, TEXT) IS 'Sends a direct message and updates the channel timestamp with parameters in order: p_channel_id, p_user_id, p_profile_id, p_content'; 