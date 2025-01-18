from typing import AsyncGenerator
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
database_url = os.getenv("DATABASE_URL")

if not supabase_url or not supabase_key:
    raise ValueError("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

if not database_url:
    raise ValueError("Missing required environment variable: DATABASE_URL must be set")

print(f"Initializing Supabase client with URL: {supabase_url}")

try:
    # Create Supabase client with service role key
    supabase: Client = create_client(
        supabase_url,
        supabase_key
    )

    # Configure the client to use service role
    supabase.postgrest.auth(supabase_key)

    # Test the connection
    test_response = supabase.postgrest\
        .from_("profiles")\
        .select("count")\
        .execute()
    print(f"Database connection test successful: {test_response}")

except Exception as e:
    print(f"Error initializing database client: {str(e)}")
    print(f"Error type: {type(e)}")
    print(f"Error args: {e.args if hasattr(e, 'args') else 'No args'}")
    if hasattr(e, 'response'):
        print(f"Response status: {e.response.status_code if hasattr(e.response, 'status_code') else 'No status'}")
        print(f"Response text: {e.response.text if hasattr(e.response, 'text') else 'No text'}")
    raise

# Set default schema to public
postgrest_client = supabase.postgrest.schema("public")

# SQLAlchemy setup
engine = create_async_engine(database_url)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db() -> AsyncGenerator[Client, None]:
    """
    Get a database client instance.
    This function returns the Supabase client with service role access.
    """
    try:
        yield supabase
    finally:
        # No need to close the client after each request
        pass

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session instance.
    This function returns an async SQLAlchemy session.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
