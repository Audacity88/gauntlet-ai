-- Create a function to ensure DM member data exists
CREATE OR REPLACE FUNCTION ensure_dm_member_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if member data already exists
    IF NOT EXISTS (
        SELECT 1 FROM public.direct_message_members
        WHERE channel_id = NEW.channel_id
        AND user_id = NEW.user_id
    ) THEN
        -- Insert member data if it doesn't exist
        INSERT INTO public.direct_message_members (
            channel_id,
            user_id,
            profile_id,
            last_read_at
        )
        SELECT
            NEW.channel_id,
            NEW.user_id,
            NEW.user_id,  -- Use user_id as profile_id since they're the same in our system
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = NEW.channel_id
            AND user_id = NEW.user_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure member data exists when sending messages
DROP TRIGGER IF EXISTS ensure_dm_member_data_trigger ON public.direct_messages;
CREATE TRIGGER ensure_dm_member_data_trigger
    BEFORE INSERT ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION ensure_dm_member_data();

-- Update existing messages to ensure member data exists
INSERT INTO public.direct_message_members (
    channel_id,
    user_id,
    profile_id,
    last_read_at
)
SELECT DISTINCT
    dm.channel_id,
    dm.user_id,
    dm.user_id as profile_id,
    NOW() as last_read_at
FROM public.direct_messages dm
WHERE NOT EXISTS (
    SELECT 1 FROM public.direct_message_members dmm
    WHERE dmm.channel_id = dm.channel_id
    AND dmm.user_id = dm.user_id
); 