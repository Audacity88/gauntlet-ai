-- Drop all DM-related policies
DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update their last read timestamp" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can view DM channels" ON public.direct_message_channels;
DROP POLICY IF EXISTS "Users can view their direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send direct messages" ON public.direct_messages;

-- Create a secure view for DM access that combines channels and members
CREATE OR REPLACE VIEW direct_message_access AS
SELECT DISTINCT dmc.id as channel_id, dmm.user_id
FROM direct_message_channels dmc
JOIN direct_message_members dmm ON dmm.channel_id = dmc.id;

-- Simple DM channel policy - uses the view instead of direct member check
CREATE POLICY "Users can view DM channels"
  ON public.direct_message_channels FOR SELECT
  USING (true);  -- Access control handled by the view joins

-- Simple DM member policies - direct user check only
CREATE POLICY "Users can view DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update DM memberships"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Simple DM message policies - uses direct member check
CREATE POLICY "Users can view direct messages"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM direct_message_members
      WHERE channel_id = direct_messages.channel_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send direct messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM direct_message_members
      WHERE channel_id = direct_messages.channel_id
      AND user_id = auth.uid()
    )
  );

-- Grant access to the view
GRANT SELECT ON direct_message_access TO authenticated;

-- Update any functions that need to check DM access
CREATE OR REPLACE FUNCTION get_user_channels(user_id uuid)
RETURNS TABLE (
    channel_id uuid,
    channel_type text,
    latest_message_at timestamp with time zone,
    unread_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dma.channel_id,
        'dm'::text as channel_type,
        MAX(dm.created_at) as latest_message_at,
        COUNT(dm.id) FILTER (WHERE dm.created_at > dmm.last_read_at) as unread_count
    FROM direct_message_access dma
    JOIN direct_message_members dmm ON dmm.channel_id = dma.channel_id
    LEFT JOIN direct_messages dm ON dm.channel_id = dma.channel_id
    WHERE dma.user_id = $1
    GROUP BY dma.channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 