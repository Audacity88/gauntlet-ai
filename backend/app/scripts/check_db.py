#!/usr/bin/env python3

import os
import sys
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings
from app.models.user import User
from app.models.message import Message

async def check_db():
    # Create engine and session
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check users
        user_query = select(User)
        user_result = await session.execute(user_query)
        users = user_result.scalars().all()
        
        print("\nUsers in database:")
        for user in users:
            print(f"ID: {user.id}")
            print(f"Email: {user.email}")
            print(f"Username: {user.username}")
            print("-" * 50)
            
            # Get messages for this user
            message_query = select(Message).where(Message.user_id == user.id)
            message_result = await session.execute(message_query)
            messages = message_result.scalars().all()
            
            print(f"Messages for {user.username}:")
            for msg in messages:
                print(f"- [{msg.created_at}] {msg.content}")
            print("=" * 50)
            print()

if __name__ == "__main__":
    asyncio.run(check_db()) 