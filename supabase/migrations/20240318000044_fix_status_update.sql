-- Drop existing status update functions
DROP FUNCTION IF EXISTS update_user_view_status(uuid, text);
DROP FUNCTION IF EXISTS update_user_status(uuid, text);

-- Create new status update function
CREATE OR REPLACE FUNCTION update_user_status(
    p_user_id uuid,
    p_status text
)
RETURNS void AS $$
BEGIN
    -- Verify the user is updating their own status
    IF auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Users can only update their own status';
    END IF;

    -- Update the status in profiles table
    UPDATE public.profiles 
    SET 
        status = p_status,
        last_seen = now(),
        updated_at = now()
    WHERE id = p_user_id;

    -- If no row was updated, something is wrong (user should always have a profile)
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found for user %', p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_status(uuid, text) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION update_user_status(uuid, text) IS 'Updates a user''s status and last_seen timestamp in their profile. Requires authentication.'; 