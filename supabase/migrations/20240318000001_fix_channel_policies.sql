-- Drop ALL existing policies
DROP POLICY IF EXISTS "channel_members_select_public" ON channel_members;
DROP POLICY IF EXISTS "channel_members_select_private" ON channel_members;
DROP POLICY IF EXISTS "channel_members_insert_public" ON channel_members;
DROP POLICY IF EXISTS "channel_members_insert_private" ON channel_members;

-- Create simplified policies for channel members
CREATE POLICY "channel_members_select" ON channel_members
  FOR SELECT USING (
    -- Allow if user is a member of the channel
    auth.uid() IN (
      SELECT user_id FROM channel_members cm 
      WHERE cm.channel_id = channel_members.channel_id
    )
    OR 
    -- Or if the channel is public
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_members.channel_id
      AND NOT c.is_private
    )
  );

CREATE POLICY "channel_members_insert" ON channel_members
  FOR INSERT WITH CHECK (
    -- Allow if user is adding themselves
    auth.uid() = user_id
    AND (
      -- To a public channel
      EXISTS (
        SELECT 1 FROM channels c
        WHERE c.id = channel_members.channel_id
        AND NOT c.is_private
      )
      OR
      -- Or if they created the channel
      EXISTS (
        SELECT 1 FROM channels c
        WHERE c.id = channel_members.channel_id
        AND c.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "channel_members_delete" ON channel_members
  FOR DELETE USING (
    -- Allow if user is deleting their own membership
    auth.uid() = user_id
    OR
    -- Or if user is the channel creator
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_members.channel_id
      AND c.created_by = auth.uid()
    )
  ); 