-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.direct_message_members CASCADE;
DROP TABLE IF EXISTS public.direct_message_channels CASCADE;

-- Create direct_message_channels table
CREATE TABLE public.direct_message_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create direct_message_members table
CREATE TABLE public.direct_message_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Create direct_messages table
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_direct_messages_channel_id ON public.direct_messages(channel_id);
CREATE INDEX idx_direct_messages_user_id ON public.direct_messages(user_id);
CREATE INDEX idx_direct_messages_profile_id ON public.direct_messages(profile_id);
CREATE INDEX idx_direct_message_members_channel_id ON public.direct_message_members(channel_id);
CREATE INDEX idx_direct_message_members_user_id ON public.direct_message_members(user_id);
CREATE INDEX idx_direct_message_members_profile_id ON public.direct_message_members(profile_id);

-- Disable RLS for now
ALTER TABLE public.direct_message_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

-- Create policies (disabled for now, but structure is here for later)
-- DROP POLICY IF EXISTS "Users can view their DM channels" ON public.direct_message_channels;
-- DROP POLICY IF EXISTS "Users can view their DM memberships" ON public.direct_message_members;
-- DROP POLICY IF EXISTS "Users can view messages in their DMs" ON public.direct_messages;
-- DROP POLICY IF EXISTS "Users can send messages in their DMs" ON public.direct_messages; 