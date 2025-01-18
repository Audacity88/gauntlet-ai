-- Update existing status values to lowercase
UPDATE public.profiles SET status = LOWER(status);

-- Add check constraint to ensure status is one of the valid values
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('online', 'offline', 'away')); 