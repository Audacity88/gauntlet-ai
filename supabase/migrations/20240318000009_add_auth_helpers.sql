-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_auth_user(uuid);

-- Create helper function to check auth.users
CREATE OR REPLACE FUNCTION public.get_auth_user(lookup_id uuid)
RETURNS TABLE (id uuid, email text)
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email::text
    FROM users u  -- Now using just 'users' since auth is in search_path
    WHERE u.id = lookup_id;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_auth_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user(uuid) TO service_role; 