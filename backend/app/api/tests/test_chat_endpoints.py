import pytest
import pytest_asyncio
from uuid import UUID, uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from httpx import AsyncClient
from app.api.endpoints.chat import router, MessageRequest
from app.models.user import User
from app.core.database import get_session
from app.api.deps import get_current_user

pytestmark = pytest.mark.asyncio

@pytest.fixture
def test_user():
    """Create a test user."""
    return User(
        id=uuid4(),
        email="test@example.com",
        hashed_password="test_hash",
        is_active=True
    )

@pytest_asyncio.fixture
async def mock_current_user(test_user):
    """Mock the current user dependency."""
    async def override_get_current_user():
        return test_user
    return override_get_current_user

@pytest_asyncio.fixture
async def mock_session():
    """Mock the database session."""
    session = AsyncMock()
    
    async def mock_execute(*args, **kwargs):
        result = AsyncMock()
        result.mappings = lambda: AsyncMock(
            one=lambda: {
                "chunks": [{"content": "Previous context", "metadata": {}}]
            }
        )
        return result
    
    session.execute = AsyncMock(side_effect=mock_execute)
    session.commit = AsyncMock()
    return session

@pytest_asyncio.fixture
async def mock_openai_client():
    """Mock the OpenAI client responses."""
    async def mock_create(*args, **kwargs):
        if kwargs.get("stream"):
            class AsyncIterator:
                def __init__(self):
                    self.chunks = [
                        MagicMock(choices=[MagicMock(delta=MagicMock(content="Test "))]),
                        MagicMock(choices=[MagicMock(delta=MagicMock(content="response"))])
                    ]
                    self.index = 0
                
                def __aiter__(self):
                    return self
                
                async def __anext__(self):
                    if self.index >= len(self.chunks):
                        raise StopAsyncIteration
                    chunk = self.chunks[self.index]
                    self.index += 1
                    return chunk
            
            return AsyncIterator()
        else:
            completion = MagicMock()
            completion.choices = [MagicMock(message=MagicMock(content="Test response"))]
            completion.model = "gpt-3.5-turbo"
            completion.usage = MagicMock(
                prompt_tokens=10,
                completion_tokens=20,
                total_tokens=30
            )
            return completion
    
    with patch("app.rag.llm.AsyncOpenAI") as mock_openai:
        client = AsyncMock()
        client.chat.completions.create = AsyncMock(side_effect=mock_create)
        mock_openai.return_value = client
        yield mock_openai

@pytest_asyncio.fixture
async def app(mock_current_user, mock_session, mock_openai_client):
    """Create a test FastAPI application."""
    app = FastAPI()
    app.include_router(router)
    
    app.dependency_overrides[get_current_user] = mock_current_user
    app.dependency_overrides[get_session] = lambda: mock_session
    
    return app

@pytest_asyncio.fixture
async def client(app):
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

async def test_send_message(client):
    """Test sending a message and receiving a response."""
    message = MessageRequest(content="Test message")
    response = await client.post("/send", json=message.model_dump())
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Test response"
    assert data["model"] == "gpt-3.5-turbo"
    assert data["usage"] == {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30
    }

async def test_send_message_with_context(client):
    """Test sending a message with context."""
    message_id = str(uuid4())
    message = MessageRequest(
        content="Test message with context",
        message_id=message_id,
        is_dm=True
    )
    response = await client.post("/send", json=message.model_dump())
    
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "Test response"
    assert data["model"] == "gpt-3.5-turbo"
    assert data["usage"] == {
        "prompt_tokens": 10,
        "completion_tokens": 20,
        "total_tokens": 30
    }

async def test_stream_message(client):
    """Test streaming a message response."""
    message = MessageRequest(content="Test streaming message")
    response = await client.post("/stream", json=message.model_dump())
    
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    
    # Read the streaming response
    chunks = []
    async for chunk in response.aiter_text():
        chunks.append(chunk)
    
    assert len(chunks) > 0
    assert "".join(chunks) == "Test response"

async def test_error_handling(client):
    """Test error handling in message endpoints."""
    # Test with invalid message format
    response = await client.post("/send", json={})
    assert response.status_code == 422  # Validation error
    
    # Test with missing required field
    response = await client.post("/send", json={"message_id": str(uuid4())})
    assert response.status_code == 422  # Validation error 