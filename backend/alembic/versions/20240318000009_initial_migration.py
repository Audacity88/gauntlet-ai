"""initial migration

Revision ID: 20240318000009
Revises: 
Create Date: 2024-01-09 17:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from uuid import uuid4


# revision identifiers, used by Alembic.
revision = '20240318000009'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing tables if they exist
    op.execute('DROP VIEW IF EXISTS public.users CASCADE')
    op.execute('DROP TABLE IF EXISTS public.direct_message_attachments CASCADE')
    op.execute('DROP TABLE IF EXISTS public.direct_messages CASCADE')
    op.execute('DROP TABLE IF EXISTS public.direct_message_members CASCADE')
    op.execute('DROP TABLE IF EXISTS public.direct_message_channels CASCADE')
    op.execute('DROP TABLE IF EXISTS public.profiles CASCADE')
    op.execute('DROP TABLE IF EXISTS auth.users CASCADE')

    # Create auth schema if it doesn't exist
    op.execute('CREATE SCHEMA IF NOT EXISTS auth')

    # Create auth functions
    op.execute('''
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $$
            SELECT COALESCE(
                current_setting('request.jwt.claim.sub', true),
                (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
            )::uuid;
        $$;
    ''')

    op.execute('''
        CREATE OR REPLACE FUNCTION auth.role() RETURNS text
        LANGUAGE sql STABLE
        AS $$
            SELECT COALESCE(
                current_setting('request.jwt.claim.role', true),
                (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
            )::text;
        $$;
    ''')

    # Create auth.users table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR NOT NULL,
            raw_user_meta_data JSONB
        )
    ''')

    # Create profiles table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            username TEXT UNIQUE,
            full_name TEXT,
            avatar_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ''')

    # Create a view for backward compatibility
    op.execute('''
        CREATE OR REPLACE VIEW public.users AS
        SELECT 
            p.id,
            p.username,
            p.full_name,
            p.avatar_url,
            p.created_at,
            p.updated_at
        FROM public.profiles p;
    ''')

    # Create RLS policy for the view
    op.execute('''
        ALTER VIEW public.users SET (security_barrier = true);
        CREATE POLICY "Users are viewable by everyone" ON public.profiles
            FOR SELECT USING (true);
    ''')

    # Create direct_message_channels table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS public.direct_message_channels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ''')

    # Create direct_message_members table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS public.direct_message_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(channel_id, user_id)
        )
    ''')

    # Create direct_messages table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS public.direct_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            channel_id UUID NOT NULL REFERENCES public.direct_message_channels(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ''')

    # Create direct_message_attachments table if it doesn't exist
    op.execute('''
        CREATE TABLE IF NOT EXISTS public.direct_message_attachments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            direct_message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
            filename VARCHAR NOT NULL,
            file_path VARCHAR NOT NULL,
            file_size INTEGER NOT NULL,
            content_type VARCHAR NOT NULL,
            inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ''')

    # Create indexes if they don't exist
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_id ON public.direct_messages(channel_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_messages_user_id ON public.direct_messages(user_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_messages_profile_id ON public.direct_messages(profile_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_message_members_channel_id ON public.direct_message_members(channel_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_message_members_user_id ON public.direct_message_members(user_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_message_members_profile_id ON public.direct_message_members(profile_id)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_direct_message_attachments_message_id ON public.direct_message_attachments(direct_message_id)')

    # Create trigger function for creating a profile when a user is created
    op.execute('''
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
            INSERT INTO public.profiles (id, username, full_name)
            VALUES (
                NEW.id,
                NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
            );
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    ''')

    # Create trigger for new user creation
    op.execute('''
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
    ''')

    # Enable RLS on profiles
    op.execute('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY')

    # Create RLS policies
    op.execute('''
        CREATE POLICY "Profiles are viewable by everyone"
            ON public.profiles FOR SELECT
            USING (true);
    ''')

    op.execute('''
        CREATE POLICY "Users can update their own profile"
            ON public.profiles FOR UPDATE
            USING (auth.uid()::text = id::text)
            WITH CHECK (auth.uid()::text = id::text);
    ''')


def downgrade():
    # Drop RLS policies
    op.execute('DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles')
    op.execute('DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles')
    op.execute('DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.profiles')

    # Drop view
    op.execute('DROP VIEW IF EXISTS public.users')

    # Drop trigger
    op.execute('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users')

    # Drop trigger function
    op.execute('DROP FUNCTION IF EXISTS public.handle_new_user()')

    # Drop auth functions
    op.execute('DROP FUNCTION IF EXISTS auth.uid()')
    op.execute('DROP FUNCTION IF EXISTS auth.role()')

    # Drop indexes
    op.execute('DROP INDEX IF EXISTS idx_direct_message_attachments_message_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_message_members_profile_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_message_members_user_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_message_members_channel_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_messages_profile_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_messages_user_id')
    op.execute('DROP INDEX IF EXISTS idx_direct_messages_channel_id')

    # Drop tables
    op.execute('DROP TABLE IF EXISTS public.direct_message_attachments')
    op.execute('DROP TABLE IF EXISTS public.direct_messages')
    op.execute('DROP TABLE IF EXISTS public.direct_message_members')
    op.execute('DROP TABLE IF EXISTS public.direct_message_channels')
    op.execute('DROP TABLE IF EXISTS public.profiles')
    op.execute('DROP TABLE IF EXISTS auth.users')
    op.execute('DROP SCHEMA IF EXISTS auth')