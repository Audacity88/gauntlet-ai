-- Drop triggers if they exist
DROP TRIGGER IF EXISTS refresh_user_profiles_on_profile ON public.profiles;

-- Drop materialized view first (if it exists)
DROP MATERIALIZED VIEW IF EXISTS public.user_profiles;

-- Drop the refresh function with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS refresh_user_profiles() CASCADE; 