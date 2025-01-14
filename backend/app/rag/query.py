from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID

from .embeddings import EmbeddingGenerator
from .storage import RAGStorage
from .context import ContextAssembler
from .llm import LLMProcessor

class RAGQueryProcessor:
    """Handles query processing and retrieval for RAG system."""
    
    def __init__(
        self,
        embedding_generator: EmbeddingGenerator,
        storage: RAGStorage,
        llm_processor: LLMProcessor,
        context_assembler: Optional[ContextAssembler] = None,
        default_top_k: int = 5,
        default_similarity_threshold: float = 0.7
    ):
        """Initialize the query processor.
        
        Args:
            embedding_generator: For generating query embeddings
            storage: For retrieving similar chunks
            llm_processor: For generating LLM responses
            context_assembler: For formatting retrieved chunks (optional)
            default_top_k: Default number of chunks to retrieve
            default_similarity_threshold: Default similarity threshold
        """
        self.embedding_generator = embedding_generator
        self.storage = storage
        self.llm_processor = llm_processor
        self.context_assembler = context_assembler or ContextAssembler()
        self.default_top_k = default_top_k
        self.default_similarity_threshold = default_similarity_threshold
    
    async def process_query(
        self,
        query_text: str,
        user_id: UUID,
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
        include_metadata: bool = True,
        system_prompt: Optional[str] = None,
        stream_response: bool = False
    ) -> Dict[str, Any]:
        """Process a query and generate a response.
        
        Args:
            query_text: The user's query text
            user_id: ID of the user making the query
            top_k: Number of chunks to retrieve (optional)
            similarity_threshold: Minimum similarity threshold (optional)
            include_metadata: Whether to include chunk metadata
            system_prompt: Optional system prompt for LLM
            stream_response: Whether to stream the response
            
        Returns:
            Dictionary containing:
            - query_text: Original query
            - retrieved_chunks: List of relevant chunks with similarity scores
            - formatted_context: Assembled context string
            - response: LLM response data
            - processing_time_ms: Processing time in milliseconds
        """
        start_time = datetime.now()
        
        # Generate query embedding
        query_chunks = [{"content": query_text, "index": 0, "metadata": {}, "token_count": 0}]
        query_embeddings = await self.embedding_generator.generate_embeddings(query_chunks)
        query_embedding = query_embeddings[0]["embedding"]
        
        # Retrieve similar chunks
        similar_chunks = await self.storage.search_similar(
            query_embedding=query_embedding,
            threshold=similarity_threshold or self.default_similarity_threshold,
            limit=top_k or self.default_top_k
        )
        
        # Assemble context
        context_data = self.context_assembler.assemble_context(
            query=query_text,
            chunks=similar_chunks,
            include_metadata=include_metadata
        )
        
        # Generate response
        if stream_response:
            response_stream = self.llm_processor.generate_stream_response(
                query=query_text,
                context=context_data["formatted_context"],
                custom_system_prompt=system_prompt
            )
            response_data = {
                "type": "stream",
                "stream": response_stream
            }
        else:
            response_data = await self.llm_processor.generate_rag_response(
                query=query_text,
                context=context_data["formatted_context"],
                custom_system_prompt=system_prompt
            )
            response_data["type"] = "complete"
        
        # Calculate processing time
        processing_time = datetime.now() - start_time
        processing_time_ms = int(processing_time.total_seconds() * 1000)
        
        # Store query for analytics
        await self.storage.store_query(
            user_id=user_id,
            query_text=query_text,
            retrieved_chunks=similar_chunks,
            latency_ms=processing_time_ms
        )
        
        return {
            "query_text": query_text,
            "retrieved_chunks": similar_chunks,
            "formatted_context": context_data["formatted_context"],
            "context_token_count": context_data["token_count"],
            "chunks_used": context_data["chunks_used"],
            "total_chunks": context_data["total_chunks"],
            "response": response_data,
            "processing_time_ms": processing_time_ms
        } 