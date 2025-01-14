import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID
from datetime import datetime

from ..query import RAGQueryProcessor
from ..embeddings import EmbeddingGenerator
from ..storage import RAGStorage

@pytest.fixture
def mock_embedding_generator():
    generator = AsyncMock(spec=EmbeddingGenerator)
    generator.generate_embeddings.return_value = [{
        "embedding": [0.1, 0.2, 0.3],  # Simplified test embedding
        "content": "test query",
        "index": 0,
        "metadata": {},
        "token_count": 2
    }]
    return generator

@pytest.fixture
def mock_storage():
    storage = AsyncMock(spec=RAGStorage)
    storage.search_similar.return_value = [
        {
            "chunk_id": UUID("12345678-1234-5678-1234-567812345678"),
            "message_id": UUID("87654321-4321-8765-4321-876543210987"),
            "content": "test message content",
            "similarity": 0.85
        }
    ]
    storage.store_query.return_value = UUID("11111111-2222-3333-4444-555555555555")
    return storage

@pytest.fixture
def query_processor(mock_embedding_generator, mock_storage):
    return RAGQueryProcessor(
        embedding_generator=mock_embedding_generator,
        storage=mock_storage,
        default_top_k=5,
        default_similarity_threshold=0.7
    )

@pytest.mark.asyncio
async def test_process_query_basic(query_processor):
    """Test basic query processing with default parameters."""
    user_id = UUID("99999999-8888-7777-6666-555555555555")
    query_text = "test query"
    
    result = await query_processor.process_query(
        query_text=query_text,
        user_id=user_id
    )
    
    # Verify query embedding was generated
    query_processor.embedding_generator.generate_embeddings.assert_called_once()
    
    # Verify similarity search was performed with default parameters
    query_processor.storage.search_similar.assert_called_once_with(
        query_embedding=[0.1, 0.2, 0.3],
        threshold=0.7,
        limit=5
    )
    
    # Verify query was stored for analytics
    query_processor.storage.store_query.assert_called_once()
    call_args = query_processor.storage.store_query.call_args[1]
    assert call_args["user_id"] == user_id
    assert call_args["query_text"] == query_text
    assert call_args["retrieved_chunks"] == query_processor.storage.search_similar.return_value
    assert isinstance(call_args["latency_ms"], int)
    
    # Verify return structure
    assert "query_text" in result
    assert "retrieved_chunks" in result
    assert "processing_time_ms" in result
    assert result["query_text"] == query_text
    assert isinstance(result["processing_time_ms"], int)

@pytest.mark.asyncio
async def test_process_query_custom_params(query_processor):
    """Test query processing with custom top_k and threshold."""
    user_id = UUID("99999999-8888-7777-6666-555555555555")
    query_text = "test query"
    custom_top_k = 10
    custom_threshold = 0.8
    
    result = await query_processor.process_query(
        query_text=query_text,
        user_id=user_id,
        top_k=custom_top_k,
        similarity_threshold=custom_threshold
    )
    
    # Verify similarity search used custom parameters
    query_processor.storage.search_similar.assert_called_once_with(
        query_embedding=[0.1, 0.2, 0.3],
        threshold=custom_threshold,
        limit=custom_top_k
    )

@pytest.mark.asyncio
async def test_process_query_error_handling(query_processor, mock_storage):
    """Test error handling during query processing."""
    # Simulate an error in similarity search
    mock_storage.search_similar.side_effect = Exception("Database error")
    
    with pytest.raises(Exception) as exc_info:
        await query_processor.process_query(
            query_text="test query",
            user_id=UUID("99999999-8888-7777-6666-555555555555")
        )
    
    assert str(exc_info.value) == "Database error" 