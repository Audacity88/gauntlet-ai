#!/usr/bin/env python3

import os
import sys
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings
from app.models.user import User
from app.models.message import Message

async def init_db():
    """Initialize the database with Supabase-compatible schema and test data."""
    print("Creating test database...")
    
    # Create engine and session
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Create schema if it doesn't exist
            await session.execute(text('CREATE SCHEMA IF NOT EXISTS auth;'))
            await session.execute(text('CREATE SCHEMA IF NOT EXISTS public;'))
            
            # Create extensions if they don't exist
            await session.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            await session.execute(text('CREATE EXTENSION IF NOT EXISTS pgcrypto;'))
            
            await session.commit()
            
            # Create tables through SQLAlchemy models
            async with engine.begin() as conn:
                await conn.run_sync(User.metadata.create_all)
                await conn.run_sync(Message.metadata.create_all)
            
            print("Database tables created successfully")
            
            # Create test users with different writing styles
            test_users = [
                {
                    "id": uuid4(),
                    "email": "test@example.com",
                    "username": "test_user",
                    "hashed_password": "test_password_hash",
                    "full_name": "Test User"
                },
                {
                    "id": uuid4(),
                    "email": "casual@example.com",
                    "username": "casual_user",
                    "hashed_password": "test_password_hash",
                    "full_name": "Casual User",
                    "messages": [
                        "hey there! how's it going? 😊",
                        "omg that's so cool! i love it",
                        "nah, not really feeling it today tbh",
                        "lol yeah that's exactly what i was thinking",
                        "can't wait for the weekend! 🎉"
                    ]
                },
                {
                    "id": uuid4(),
                    "email": "formal@example.com",
                    "username": "formal_user",
                    "hashed_password": "test_password_hash",
                    "full_name": "Formal User",
                    "messages": [
                        "I hope this message finds you well.",
                        "That's an interesting perspective. Could you elaborate?",
                        "I respectfully disagree with that assessment.",
                        "Indeed, the data supports your conclusion.",
                        "Let's schedule a meeting to discuss this further."
                    ]
                }
            ]
            
            # Insert users and their messages
            for user_data in test_users:
                messages = user_data.pop("messages", [])
                user = User(**user_data)
                session.add(user)
                await session.flush()  # Get the user ID
                
                # Add messages for this user
                for i, content in enumerate(messages):
                    message = Message(
                        id=uuid4(),
                        user_id=user.id,
                        content=content,
                        created_at=datetime.utcnow() - timedelta(hours=i)
                    )
                    session.add(message)
            
            await session.commit()
            print("Test users and messages created successfully")
            
            # Print user IDs for testing
            print("\nTest User IDs (use these with the /target command):")
            for user_data in test_users:
                print(f"{user_data['username']}: {user_data['id']}")
            
            print("\nDatabase initialization completed successfully")
            
        except Exception as e:
            print(f"Error during database initialization: {str(e)}")
            raise

if __name__ == "__main__":
    asyncio.run(init_db()) 