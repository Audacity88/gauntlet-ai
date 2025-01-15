from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import event, text
from app.core.config import settings
import logging
import ssl

logger = logging.getLogger(__name__)

# Create SSL context for production
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Create async engine with connection arguments
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    future=True,
    pool_pre_ping=True,  # Add connection health check
    pool_size=5,  # Set reasonable pool size
    max_overflow=10,  # Allow some overflow connections
    connect_args={
        "server_settings": {
            "application_name": "gauntlet-ai",
            "search_path": "public,auth",  # Include auth schema in search path
        },
        "ssl": ssl_context if settings.ENVIRONMENT == "production" else None
    }
)

# Create async session factory
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

# Dependency to get async session
async def get_session() -> AsyncSession:
    session = async_session()
    try:
        # Set the role for RLS using proper text() function
        await session.execute(text("SET ROLE authenticated;"))
        yield session
    finally:
        await session.close() 