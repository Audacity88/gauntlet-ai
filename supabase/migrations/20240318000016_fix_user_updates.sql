-- Drop the users view if it exists
DROP VIEW IF EXISTS public.users;

-- Create user_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_status (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status text DEFAULT 'offline',
    last_seen timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_status
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all statuses" ON public.user_status;
DROP POLICY IF EXISTS "Users can update their own status" ON public.user_status;
DROP POLICY IF EXISTS "Users can insert their own status" ON public.user_status;

-- Create policies for user_status
CREATE POLICY "Users can view all statuses"
  ON public.user_status FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own status"
  ON public.user_status FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own status"
  ON public.user_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Create a function to update user status
CREATE OR REPLACE FUNCTION update_user_status(p_user_id uuid, p_status text)
RETURNS void AS $$
BEGIN
    INSERT INTO public.user_status (user_id, status, last_seen, updated_at)
    VALUES (p_user_id, p_status, now(), now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = p_status,
        last_seen = now(),
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a materialized view for user data that will be refreshed periodically
CREATE MATERIALIZED VIEW public.user_profiles AS
SELECT 
    au.id,
    au.email,
    p.username,
    p.full_name,
    us.status,
    us.last_seen
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_status us ON us.user_id = au.id;

-- Create an index on the materialized view
CREATE UNIQUE INDEX ON public.user_profiles (id);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_profiles()
RETURNS trigger AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_profiles;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_user_profiles_on_status
    AFTER INSERT OR UPDATE OR DELETE ON public.user_status
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_user_profiles();

CREATE TRIGGER refresh_user_profiles_on_profile
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_user_profiles();

-- Grant necessary permissions
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_status TO authenticated; 