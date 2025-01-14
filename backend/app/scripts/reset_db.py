#!/usr/bin/env python3

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv
from pathlib import Path
import sys

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent.parent))

# Load environment variables
load_dotenv()

from app.models.base import Base
from app.models.channel import Channel, ChannelMember
from app.models.message import Message, MessageAttachment
from app.models.user import User, Profile
from app.models.direct_message import DirectMessage, DirectMessageChannel, DirectMessageMember

async def reset_database():
    # Database connection
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    # Convert postgresql:// to postgresql+asyncpg://
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url)

    print("Truncating all tables...")
    async with engine.begin() as conn:
        # Disable triggers temporarily
        await conn.execute(text('SET session_replication_role = replica;'))
        
        # Truncate tables in order (child tables first)
        await conn.execute(text('TRUNCATE TABLE public.message_chunks CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.message_embeddings CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.message_attachments CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.direct_message_attachments CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.messages CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.direct_messages CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.channel_members CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.dm_channel_members CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.channels CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.direct_message_channels CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE public.profiles CASCADE;'))
        await conn.execute(text('TRUNCATE TABLE auth.users CASCADE;'))

        # Re-enable triggers
        await conn.execute(text('SET session_replication_role = DEFAULT;'))

    print("Database reset complete!")

if __name__ == "__main__":
    asyncio.run(reset_database()) 