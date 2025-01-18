<<<<<<< HEAD
from typing import AsyncGenerator
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

print(f"Initializing Supabase client with URL: {supabase_url}")

try:
    # Create client with service role key
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
=======
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging
import certifi

logger = logging.getLogger(__name__)

# Get database URL from settings
db_url = settings.DATABASE_URL

# Create SSL context with proper certificate verification
ssl_context = ssl.create_default_context(cafile=certifi.where())

# For development/testing environments, allow self-signed certificates
if settings.ENVIRONMENT != "production":
    logger.warning("SSL certificate verification disabled for non-production environment")
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
else:
    logger.info("SSL certificate verification enabled for production environment")
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED

# Log SSL configuration
logger.debug(f"Using certifi CA bundle at: {certifi.where()}")
logger.debug(f"SSL verify mode: {ssl_context.verify_mode}")
logger.debug(f"SSL check hostname: {ssl_context.check_hostname}")

# Create async engine with SSL context
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=0,
    connect_args={
        "ssl": ssl_context,
        "server_settings": {
            "application_name": "gauntlet-ai"
        }
    }
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Dependency to get database session
async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close() 
>>>>>>> 5b6fbe7e4dd5bb01e4c8c5c98fe126e78fe44646
