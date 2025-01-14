import pytest
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Test database URL - use a separate database for testing
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/test_db"
)

@pytest.fixture
async def db_session():
    """Create a test database session."""
    engine = create_async_engine(TEST_DATABASE_URL)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()
    
    await engine.dispose()

@pytest.fixture
def test_user_id():
    """Return a consistent test user ID."""
    return "99999999-8888-7777-6666-555555555555"

@pytest.fixture
def test_message_id():
    """Return a consistent test message ID."""
    return "12345678-1234-5678-1234-567812345678"

# Configure pytest-asyncio
def pytest_configure(config):
    """Configure pytest-asyncio as the default async test runner."""
    config.addinivalue_line(
        "markers",
        "asyncio: mark test as requiring asyncio"
    ) 