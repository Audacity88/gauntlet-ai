-- Drop redundant views first
DROP VIEW IF EXISTS dm_members;
DROP VIEW IF EXISTS users;

-- Add status fields to profiles table
ALTER TABLE profiles
ADD COLUMN status TEXT DEFAULT 'OFFLINE',
ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;

-- Migrate data from user_status
UPDATE profiles p
SET status = us.status,
    last_seen = us.last_seen
FROM user_status us
WHERE p.id = us.user_id;

-- Drop user_status table
DROP TABLE user_status CASCADE;

-- Drop old view before recreating
DROP VIEW IF EXISTS direct_message_members;

-- Create the new view with all needed fields
CREATE OR REPLACE VIEW direct_message_members AS
SELECT 
    dcm.id,
    dcm.channel_id,
    dcm.user_id,
    p.id as profile_id,
    dcm.last_read_at,
    dcm.created_at,
    p.username,
    p.full_name,
    p.avatar_url
FROM dm_channel_members dcm
JOIN profiles p ON p.id = dcm.user_id;

-- Recreate necessary indexes on the base tables
CREATE INDEX IF NOT EXISTS idx_dm_channel_members_channel_user 
ON dm_channel_members (channel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_status 
ON profiles (status);

-- Grant access to the view
GRANT SELECT ON direct_message_members TO authenticated;