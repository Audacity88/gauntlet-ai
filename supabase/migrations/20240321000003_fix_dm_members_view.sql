-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS insert_direct_message_members_trigger ON direct_message_members;

-- Create trigger function
CREATE OR REPLACE FUNCTION insert_direct_message_members()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into dm_channel_members
  WITH inserted_member AS (
    INSERT INTO dm_channel_members (channel_id, user_id, last_read_at, created_at)
    VALUES (NEW.channel_id, NEW.user_id, COALESCE(NEW.last_read_at, NOW()), COALESCE(NEW.created_at, NOW()))
    RETURNING id
  )
  -- No need to insert into dm_member_profiles since we're using user_id as profile_id
  SELECT id FROM inserted_member INTO NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create INSTEAD OF INSERT trigger on the view
CREATE TRIGGER insert_direct_message_members_trigger
  INSTEAD OF INSERT ON direct_message_members
  FOR EACH ROW
  EXECUTE FUNCTION insert_direct_message_members();

-- Grant INSERT on the view to authenticated users
GRANT INSERT ON direct_message_members TO authenticated; 