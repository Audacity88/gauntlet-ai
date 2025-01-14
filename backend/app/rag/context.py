from typing import List, Dict, Any, Optional
from datetime import datetime
import tiktoken

class ContextAssembler:
    """Assembles context from retrieved chunks for RAG responses."""
    
    def __init__(
        self,
        max_tokens: int = 3000,
        model_name: str = "gpt-4",
        token_buffer: int = 500
    ):
        """Initialize the context assembler.
        
        Args:
            max_tokens: Maximum number of tokens in the context
            model_name: Name of the model to use for token counting
            token_buffer: Number of tokens to reserve for the response
        """
        self.max_tokens = max_tokens
        self.model_name = model_name
        self.token_buffer = token_buffer
        self.encoding = tiktoken.encoding_for_model(model_name)
    
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string."""
        return len(self.encoding.encode(text))
    
    def _format_chunk_metadata(self, chunk: Dict[str, Any]) -> str:
        """Format metadata from a chunk."""
        timestamp = chunk.get("timestamp")
        if isinstance(timestamp, str):
            try:
                dt = datetime.fromisoformat(timestamp)
                formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                formatted_time = timestamp
        else:
            formatted_time = str(timestamp)
        
        return (
            f"Author: {chunk.get('author', 'Unknown')}\n"
            f"Channel: {chunk.get('channel_name', 'Unknown')}\n"
            f"Time: {formatted_time}\n"
            f"Similarity: {chunk.get('similarity', 0):.2f}\n"
        )
    
    def assemble_context(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        include_metadata: bool = True
    ) -> Dict[str, Any]:
        """Assemble context from retrieved chunks.
        
        Args:
            query: The user's query
            chunks: List of chunks with content and metadata
            include_metadata: Whether to include chunk metadata
        
        Returns:
            Dictionary containing formatted context and stats
        """
        # Sort chunks by similarity score
        sorted_chunks = sorted(
            chunks,
            key=lambda x: float(x.get("similarity", 0)),
            reverse=True
        )
        
        formatted_chunks = []
        total_tokens = 0
        chunks_used = 0
        
        # Format each chunk and add to context if within token limit
        for chunk in sorted_chunks:
            chunk_text = chunk.get("content", "")
            if include_metadata:
                metadata = self._format_chunk_metadata(chunk)
                chunk_text = f"{metadata}\nContent:\n{chunk_text}\n---\n"
            
            chunk_tokens = self._count_tokens(chunk_text)
            if total_tokens + chunk_tokens > self.max_tokens - self.token_buffer:
                break
            
            formatted_chunks.append(chunk_text)
            total_tokens += chunk_tokens
            chunks_used += 1
        
        return {
            "formatted_context": "\n".join(formatted_chunks),
            "token_count": total_tokens,
            "chunks_used": chunks_used,
            "total_chunks": len(chunks)
        } 