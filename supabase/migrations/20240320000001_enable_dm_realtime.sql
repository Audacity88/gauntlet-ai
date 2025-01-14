-- Enable Realtime for DM channel members
ALTER PUBLICATION supabase_realtime ADD TABLE dm_channel_members;

-- Set replica identity to full to get old record data on updates/deletes
ALTER TABLE dm_channel_members REPLICA IDENTITY FULL; 