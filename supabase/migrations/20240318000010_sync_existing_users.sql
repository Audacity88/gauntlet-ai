-- Function to sync existing users
CREATE OR REPLACE FUNCTION public.sync_existing_users()
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', email)
  FROM auth.users
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = users.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync for existing users
SELECT public.sync_existing_users(); 