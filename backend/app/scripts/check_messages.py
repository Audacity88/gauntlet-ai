#!/usr/bin/env python3
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Initialize async database engine
db_url = settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
engine = create_async_engine(db_url)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def check_messages():
    """Check messages in the database."""
    async with async_session() as session:
        # Check if table exists
        query = text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'messages'
            )
        """)
        result = await session.execute(query)
        exists = result.scalar()
        print(f"Messages table exists: {exists}")

        if not exists:
            return

        # Get message count
        query = text("SELECT COUNT(*) FROM messages")
        result = await session.execute(query)
        count = result.scalar()
        print(f"\nTotal messages: {count}")

        if count > 0:
            # Get sample messages
            query = text("""
                SELECT 
                    id,
                    content,
                    channel_id,
                    profile_id,
                    inserted_at
                FROM messages
                LIMIT 5
            """)
            result = await session.execute(query)
            print("\nSample messages:")
            for row in result:
                print(f"\nID: {row.id}")
                print(f"Content: {row.content}")
                print(f"Channel: {row.channel_id}")
                print(f"Profile: {row.profile_id}")
                print(f"Inserted: {row.inserted_at}")

if __name__ == "__main__":
    asyncio.run(check_messages()) 