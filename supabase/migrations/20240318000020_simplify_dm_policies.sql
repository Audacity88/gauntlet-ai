-- Drop existing policies
DROP POLICY IF EXISTS "Users can view DM memberships" ON public.direct_message_members;
DROP POLICY IF EXISTS "Users can update DM memberships" ON public.direct_message_members;

-- Create a function to check DM channel membership
CREATE OR REPLACE FUNCTION is_dm_channel_member(channel_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.direct_message_members
        WHERE channel_id = channel_uuid AND user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a materialized view for DM channel memberships
CREATE MATERIALIZED VIEW public.dm_channel_memberships AS
SELECT DISTINCT channel_id, array_agg(user_id) as member_ids
FROM public.direct_message_members
GROUP BY channel_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX ON public.dm_channel_memberships (channel_id);

-- Create simple policies without recursion
CREATE POLICY "Users can view their own DM memberships"
  ON public.direct_message_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own DM memberships"
  ON public.direct_message_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_dm_memberships()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.dm_channel_memberships;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to refresh the view
CREATE TRIGGER refresh_dm_memberships_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.direct_message_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_dm_memberships();

-- Grant necessary permissions
GRANT SELECT ON public.dm_channel_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION is_dm_channel_member TO authenticated; 