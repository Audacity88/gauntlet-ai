#!/usr/bin/env python3

import os
import sys
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.core.config import settings

async def check_supabase():
    """Test connection to Supabase database."""
    print(f"Testing connection to: {settings.DATABASE_URL}")
    
    try:
        # Create engine and session
        engine = create_async_engine(settings.DATABASE_URL)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # Test basic connection
            result = await session.execute(text("SELECT 1"))
            await result.scalar()
            print("\nBasic connection test successful!")
            
            # Get database info
            result = await session.execute(text(
                "SELECT current_database(), current_user, version()"
            ))
            db_info = result.one()
            print(f"\nDatabase Info:")
            print(f"Database: {db_info[0]}")
            print(f"User: {db_info[1]}")
            print(f"Version: {db_info[2]}")
            
            # Check schemas
            result = await session.execute(text(
                "SELECT schema_name FROM information_schema.schemata"
            ))
            schemas = [row[0] for row in result]
            print("\nAvailable schemas:")
            for schema in schemas:
                print(f"- {schema}")
            
            # Check extensions
            result = await session.execute(text(
                "SELECT extname, extversion FROM pg_extension"
            ))
            extensions = result.all()
            print("\nInstalled extensions:")
            for ext in extensions:
                print(f"- {ext[0]} (version {ext[1]})")
            
            # Check tables in auth schema
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'auth'
            """))
            tables = result.scalars().all()
            print("\nTables in auth schema:")
            for table in tables:
                print(f"- {table}")
            
            # Check tables in public schema
            result = await session.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            tables = result.scalars().all()
            print("\nTables in public schema:")
            for table in tables:
                print(f"- {table}")
            
    except Exception as e:
        print(f"\nError connecting to database: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(check_supabase()) 