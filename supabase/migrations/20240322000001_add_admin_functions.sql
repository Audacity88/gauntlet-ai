-- Create admin function to create users
CREATE OR REPLACE FUNCTION admin_create_user(
    p_id uuid,
    p_email text,
    p_raw_user_meta_data jsonb
)
RETURNS auth.users
SECURITY DEFINER
SET search_path = auth, public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user auth.users;
BEGIN
    -- Create the user in auth.users
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (p_id, p_email, p_raw_user_meta_data)
    RETURNING * INTO v_user;
    
    RETURN v_user;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION admin_create_user(uuid, text, jsonb) TO service_role;

-- Add explicit comment for PostgREST
COMMENT ON FUNCTION admin_create_user(uuid, text, jsonb) IS 'Creates a new user in auth.users with the given ID, email, and metadata'; 