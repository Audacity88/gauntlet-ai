-- Drop the incorrect constraint
ALTER TABLE direct_message_members 
DROP CONSTRAINT IF EXISTS dm_members_prevent_self_dms;

-- Add correct constraints
DO $$ 
DECLARE
    v_constraint_exists boolean;
BEGIN
    -- Check if unique constraint exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'dm_members_unique_channel_user'
    ) INTO v_constraint_exists;

    -- Add unique constraint if it doesn't exist
    IF NOT v_constraint_exists THEN
        ALTER TABLE direct_message_members
        ADD CONSTRAINT dm_members_unique_channel_user
        UNIQUE (channel_id, user_id);
    END IF;

    -- Check if unique constraint exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'dm_members_unique_channel_profile'
    ) INTO v_constraint_exists;

    -- Add unique constraint if it doesn't exist
    IF NOT v_constraint_exists THEN
        ALTER TABLE direct_message_members
        ADD CONSTRAINT dm_members_unique_channel_profile
        UNIQUE (channel_id, profile_id);
    END IF;
END $$; 