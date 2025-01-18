-- Drop all functions in reverse order of creation
DROP FUNCTION IF EXISTS get_dm_messages(uuid, integer);
DROP FUNCTION IF EXISTS get_channel_messages(uuid, integer);
DROP FUNCTION IF EXISTS send_direct_message(uuid, uuid, uuid, text, text, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS send_message(uuid, uuid, uuid, text, text, uuid, jsonb, jsonb);
DROP FUNCTION IF EXISTS find_or_create_dm_channel(uuid, uuid);

-- Revoke permissions (not strictly necessary since dropping functions removes permissions)
REVOKE EXECUTE ON FUNCTION get_dm_messages FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_channel_messages FROM authenticated;
REVOKE EXECUTE ON FUNCTION send_direct_message FROM authenticated;
REVOKE EXECUTE ON FUNCTION send_message FROM authenticated;
REVOKE EXECUTE ON FUNCTION find_or_create_dm_channel FROM authenticated; 