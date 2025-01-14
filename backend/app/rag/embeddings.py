from typing import List, Dict, Any
import numpy as np
from openai import OpenAI, AsyncOpenAI
from .chunker import TextChunk

class EmbeddingGenerator:
    """Handles generation of embeddings using OpenAI's API."""
    
    def __init__(
        self,
        api_key: str,
        model_name: str = "text-embedding-ada-002",
        batch_size: int = 100
    ):
        """Initialize the embedding generator.
        
        Args:
            api_key: OpenAI API key
            model_name: Name of the embedding model to use
            batch_size: Number of texts to embed in one API call
        """
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = model_name
        self.batch_size = batch_size
        self.embedding_dim = 1536  # Ada-002 dimension
    
    async def generate_embeddings(
        self,
        chunks: List[TextChunk]
    ) -> List[Dict[str, Any]]:
        """Generate embeddings for a list of text chunks.
        
        Args:
            chunks: List of TextChunk objects to embed
        
        Returns:
            List of dictionaries containing chunk info and embeddings
        """
        results = []
        
        # Process chunks in batches
        for i in range(0, len(chunks), self.batch_size):
            batch = chunks[i:i + self.batch_size]
            
            # Get embeddings from OpenAI
            response = await self.client.embeddings.create(
                model=self.model_name,
                input=[chunk.content for chunk in batch]
            )
            
            # Process response
            for chunk, embedding_data in zip(batch, response.data):
                results.append({
                    "chunk_content": chunk.content,
                    "chunk_index": chunk.index,
                    "metadata": chunk.metadata,
                    "token_count": chunk.token_count,
                    "embedding": embedding_data.embedding
                })
        
        return results
    
    def compute_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Compute cosine similarity between two embeddings."""
        return np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        ) 