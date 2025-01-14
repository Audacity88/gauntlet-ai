from typing import List, Dict, Any, Optional, Union
from uuid import UUID
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from .chunker import TextChunk

class RAGStorage:
    """Handles storage and retrieval of chunks and embeddings."""
    
    def __init__(self, session: AsyncSession):
        """Initialize the storage handler.
        
        Args:
            session: SQLAlchemy async session
        """
        self.session = session
    
    async def store_chunks(
        self,
        chunks: List[Dict[str, Any]],
        message_id: Optional[UUID] = None,
        dm_message_id: Optional[UUID] = None
    ) -> List[UUID]:
        """Store message chunks and their embeddings.
        
        Args:
            chunks: List of dictionaries containing chunk data and embeddings
            message_id: ID of the regular message (if applicable)
            dm_message_id: ID of the DM message (if applicable)
        
        Returns:
            List of stored chunk IDs
        """
        chunk_ids = []
        
        for chunk in chunks:
            try:
                # Store chunk
                query = text("""
                    INSERT INTO message_chunks 
                    (message_id, dm_message_id, chunk_index, chunk_content, metadata)
                    VALUES (:message_id, :dm_message_id, :chunk_index, :chunk_content, :metadata)
                    RETURNING id
                """)
                
                result = await self.session.execute(
                    query,
                    {
                        "message_id": message_id,
                        "dm_message_id": dm_message_id,
                        "chunk_index": chunk["chunk_index"],
                        "chunk_content": chunk["chunk_content"],
                        "metadata": json.dumps(chunk["metadata"])
                    }
                )
                chunk_id = result.scalar_one()
                chunk_ids.append(chunk_id)
                
                # Store embedding
                query = text("""
                    INSERT INTO message_embeddings
                    (chunk_id, embedding_vector)
                    SELECT :chunk_id, CAST(:embedding AS vector)
                """)
                
                # Convert embedding list to PostgreSQL array format
                embedding_str = "[" + ",".join(map(str, chunk["embedding"])) + "]"
                
                await self.session.execute(
                    query,
                    {
                        "chunk_id": chunk_id,
                        "embedding": embedding_str
                    }
                )
                
                await self.session.commit()
                
            except Exception as e:
                await self.session.rollback()
                raise e
        
        return chunk_ids
    
    async def search_similar(
        self,
        query_embedding: List[float],
        threshold: float = 0.7,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for similar chunks using vector similarity.
        
        Args:
            query_embedding: The query embedding vector
            threshold: Minimum similarity threshold
            limit: Maximum number of results to return
        
        Returns:
            List of similar chunks with their metadata
        """
        query = text("""
            SELECT * FROM search_similar_messages(
                CAST(:embedding AS vector),
                :threshold,
                :limit
            )
        """)
        
        # Convert embedding list to PostgreSQL array format
        embedding_str = "[" + ",".join(map(str, query_embedding)) + "]"
        
        result = await self.session.execute(
            query,
            {
                "embedding": embedding_str,
                "threshold": threshold,
                "limit": limit
            }
        )
        
        return [dict(row) for row in result]
    
    async def get_message_context(
        self,
        message_id: Union[UUID, str],
        is_dm: bool = False
    ) -> Dict[str, Any]:
        """Get the full context of a message.
        
        Args:
            message_id: ID of the message
            is_dm: Whether this is a DM message
        
        Returns:
            Dictionary containing message context
        """
        table = "direct_messages" if is_dm else "messages"
        id_field = "dm_message_id" if is_dm else "message_id"
        
        query = text(f"""
            WITH message_data AS (
                SELECT m.*, p.username, p.full_name
                FROM {table} m
                JOIN profiles p ON p.id = m.profile_id
                WHERE m.id = :message_id
            )
            SELECT 
                m.*,
                array_agg(DISTINCT c.chunk_content) as chunks
            FROM message_data m
            LEFT JOIN message_chunks c ON c.{id_field} = m.id
            GROUP BY m.id, m.channel_id, m.user_id, m.profile_id,
                     m.content, m.created_at, m.updated_at,
                     m.username, m.full_name
        """)
        
        result = await self.session.execute(
            query,
            {"message_id": str(message_id)}
        )
        
        return dict(result.mappings().one()) 