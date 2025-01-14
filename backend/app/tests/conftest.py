import pytest
import asyncio
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.database import Base, get_session
from app.api.deps import get_current_user
from app.models.user import User

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def engine():
    """Create engine and tables."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=True,
        future=True
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a new database session for a test."""
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session

@pytest.fixture
async def test_user(session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        hashed_password="test_password_hash",
        is_active=True
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user

@pytest.fixture
async def mock_current_user(test_user: User):
    """Mock the get_current_user dependency."""
    async def override_get_current_user():
        return test_user
    return override_get_current_user

@pytest.fixture
def mock_openai_client():
    """Create a mock OpenAI client."""
    mock_client = MagicMock()
    
    # Mock chat completion response
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(content="Test response"))]
    mock_completion.model = "gpt-4"
    mock_completion.usage = MagicMock(
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30
    )
    
    # Mock streaming response
    async def mock_stream():
        chunks = ["Test", " chunk", " 1", " Test", " chunk", " 2"]
        for chunk in chunks:
            mock_chunk = MagicMock()
            mock_chunk.choices = [MagicMock(delta=MagicMock(content=chunk))]
            yield mock_chunk
    
    # Set up async chat completion methods
    mock_client.chat.completions.create = AsyncMock(side_effect=lambda **kwargs: 
        mock_stream() if kwargs.get("stream") else mock_completion
    )
    
    return mock_client

@pytest.fixture
async def mock_session():
    """Create a mock database session."""
    session = AsyncMock()
    
    # Mock message context retrieval
    async def mock_execute(query, params):
        result = MagicMock()
        result.mappings().one.return_value = {
            "id": params["message_id"],
            "content": "Previous message content",
            "chunks": ["Chunk 1", "Chunk 2"],
            "username": "test_user",
            "created_at": "2024-01-14T12:00:00"
        }
        return result
    
    session.execute = mock_execute
    return session 