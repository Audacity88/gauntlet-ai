from typing import List, Dict, Optional
import tiktoken
from dataclasses import dataclass

@dataclass
class TextChunk:
    """Represents a chunk of text with metadata."""
    content: str
    index: int
    metadata: Dict
    token_count: int

class MessageChunker:
    """Handles chunking of messages into smaller pieces for embedding."""
    
    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        model_name: str = "text-embedding-ada-002"
    ):
        """Initialize the chunker with configuration.
        
        Args:
            chunk_size: Maximum number of tokens per chunk
            chunk_overlap: Number of tokens to overlap between chunks
            model_name: Name of the model for tokenization
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.tokenizer = tiktoken.encoding_for_model(model_name)
    
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text."""
        return len(self.tokenizer.encode(text))
    
    def create_chunks(
        self,
        text: str,
        metadata: Optional[Dict] = None
    ) -> List[TextChunk]:
        """Split text into chunks with overlap.
        
        Args:
            text: The text to chunk
            metadata: Optional metadata to attach to each chunk
        
        Returns:
            List of TextChunk objects
        """
        if not text.strip():
            return []
        
        metadata = metadata or {}
        tokens = self.tokenizer.encode(text)
        chunks = []
        
        # Handle short texts that fit in one chunk
        if len(tokens) <= self.chunk_size:
            return [TextChunk(
                content=text,
                index=0,
                metadata=metadata,
                token_count=len(tokens)
            )]
        
        # Split into overlapping chunks
        start = 0
        chunk_index = 0
        
        while start < len(tokens):
            # Get chunk tokens
            end = min(start + self.chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            
            # Decode chunk back to text
            chunk_text = self.tokenizer.decode(chunk_tokens)
            
            # Create chunk with metadata
            chunks.append(TextChunk(
                content=chunk_text,
                index=chunk_index,
                metadata=metadata.copy(),
                token_count=len(chunk_tokens)
            ))
            
            # Move start position for next chunk, accounting for overlap
            start = end - self.chunk_overlap
            chunk_index += 1
        
        return chunks 