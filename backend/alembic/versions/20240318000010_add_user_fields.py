"""add user fields

Revision ID: 20240318000010
Revises: 20240318000009
Create Date: 2024-01-15 09:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from uuid import uuid4

# revision identifiers, used by Alembic.
revision = '20240318000010'
down_revision = '20240318000009'
branch_labels = None
depends_on = None

def upgrade():
    # Add new columns to auth.users table
    op.execute('''
        ALTER TABLE auth.users
        ADD COLUMN IF NOT EXISTS encrypted_password VARCHAR,
        ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ''')

def downgrade():
    # Remove added columns from auth.users table
    op.execute('''
        ALTER TABLE auth.users
        DROP COLUMN IF EXISTS encrypted_password,
        DROP COLUMN IF EXISTS email_confirmed_at,
        DROP COLUMN IF EXISTS last_sign_in_at,
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS is_super_admin;
    ''') 