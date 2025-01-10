-- Create a regular view for backward compatibility
CREATE OR REPLACE VIEW public.users AS
SELECT 
    au.id,
    au.email,
    p.username,
    p.full_name,
    COALESCE(us.status, 'offline') as status,
    COALESCE(us.last_seen, now()) as last_seen,
    p.created_at,
    p.updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_status us ON us.user_id = au.id;

-- Grant access to the view
GRANT SELECT ON public.users TO authenticated;

-- Create a function to update user status through the view
CREATE OR REPLACE FUNCTION update_user_view_status(p_user_id uuid, p_status text)
RETURNS void AS $$
BEGIN
    -- First try to update
    UPDATE public.user_status 
    SET status = p_status,
        last_seen = now(),
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- If no row was updated, insert
    IF NOT FOUND THEN
        INSERT INTO public.user_status (user_id, status, last_seen, updated_at)
        VALUES (p_user_id, p_status, now(), now());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_user_view_status TO authenticated; 