-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.channel_members CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.direct_message_channels CASCADE;
DROP TABLE IF EXISTS public.direct_message_members CASCADE;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create channels table
CREATE TABLE public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    created_by UUID NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create channel_members table
CREATE TABLE public.channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL,
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channel_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE,
    CONSTRAINT channel_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT channel_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(channel_id, user_id)
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL,
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    content TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE,
    CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT messages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create direct_messages table
CREATE TABLE public.direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL,
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT direct_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT direct_messages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create direct_message_channels table
CREATE TABLE public.direct_message_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create direct_message_members table
CREATE TABLE public.direct_message_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL,
    user_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT direct_message_members_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
    CONSTRAINT direct_message_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT direct_message_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(channel_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX idx_messages_user_id ON public.messages(user_id);
CREATE INDEX idx_channel_members_channel_id ON public.channel_members(channel_id);
CREATE INDEX idx_channel_members_user_id ON public.channel_members(user_id);

-- Enable RLS
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_members ENABLE ROW LEVEL SECURITY;

-- Create policies for channels
CREATE POLICY "Users can view channels" ON public.channels
  FOR SELECT USING (true);

CREATE POLICY "Users can create channels" ON public.channels
  FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);

-- Add DELETE policy for channels
CREATE POLICY "Users can delete their own channels" ON public.channels
  FOR DELETE USING (auth.uid()::text = created_by::text);

-- Create policies for channel_members
CREATE POLICY "Users can view channel members" ON public.channel_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join channels" ON public.channel_members
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Create policies for messages
CREATE POLICY "Users can view messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id::text AND
    EXISTS (
      SELECT 1 FROM public.channel_members 
      WHERE channel_id = messages.channel_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Create a trigger to create a profile for each new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policies for direct messages
CREATE POLICY "Users can view direct messages they are members of" ON public.direct_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_messages.channel_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send direct messages" ON public.direct_messages
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id::text AND
        EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_messages.channel_id
            AND user_id = auth.uid()
        )
    );

-- Create policies for direct message channels
CREATE POLICY "Users can view their DM channels" ON public.direct_message_channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_message_channels.id
            AND user_id = auth.uid()
        )
    );

-- Create policies for direct message members
CREATE POLICY "Users can view DM members" ON public.direct_message_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.direct_message_members
            WHERE channel_id = direct_message_members.channel_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join DM channels" ON public.direct_message_members
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text); 