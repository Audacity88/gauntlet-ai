from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    future=True,
    pool_pre_ping=True,  # Add connection health check
    pool_size=5,  # Set reasonable pool size
    max_overflow=10  # Allow some overflow connections
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
        yield session
    finally:
        await session.close() 