-- First, create a temporary table to store the channels we want to keep
CREATE TEMP TABLE channels_to_keep AS
WITH RankedChannels AS (
  SELECT 
    DISTINCT ON (
      LEAST(dm1.user_id, dm2.user_id),
      GREATEST(dm1.user_id, dm2.user_id)
    )
    dmc.id as channel_id,
    dmc.created_at,
    LEAST(dm1.user_id, dm2.user_id) as user1_id,
    GREATEST(dm1.user_id, dm2.user_id) as user2_id
  FROM direct_message_channels dmc
  JOIN direct_message_members dm1 ON dm1.channel_id = dmc.id
  JOIN direct_message_members dm2 ON dm2.channel_id = dmc.id
  WHERE dm1.user_id != dm2.user_id
    AND dm1.user_id != dm1.profile_id  -- Exclude self-referential members
    AND dm2.user_id != dm2.profile_id  -- Exclude self-referential members
  ORDER BY 
    LEAST(dm1.user_id, dm2.user_id),
    GREATEST(dm1.user_id, dm2.user_id),
    dmc.created_at ASC
)
SELECT * FROM RankedChannels;

-- Delete messages in channels that will be deleted
DELETE FROM direct_messages
WHERE channel_id IN (
  SELECT id FROM direct_message_channels
  WHERE id NOT IN (SELECT channel_id FROM channels_to_keep)
);

-- Delete members in channels that will be deleted
DELETE FROM direct_message_members
WHERE channel_id IN (
  SELECT id FROM direct_message_channels
  WHERE id NOT IN (SELECT channel_id FROM channels_to_keep)
);

-- Delete the duplicate channels
DELETE FROM direct_message_channels
WHERE id NOT IN (SELECT channel_id FROM channels_to_keep);

-- Add constraint to prevent self-DMs
ALTER TABLE direct_message_members
ADD CONSTRAINT prevent_self_dms
CHECK (user_id != profile_id);

-- Create a unique index to prevent future duplicates (only for different users)
CREATE UNIQUE INDEX IF NOT EXISTS unique_dm_channel_members ON direct_message_members (
  LEAST(user_id, profile_id),
  GREATEST(user_id, profile_id)
)
WHERE user_id != profile_id;  -- Only apply uniqueness constraint when users are different

-- Drop the temporary table
DROP TABLE channels_to_keep; 