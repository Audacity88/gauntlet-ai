#!/usr/bin/env python3
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Initialize async database engine
db_url = settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
engine = create_async_engine(db_url)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def check_embeddings():
    """Check stored chunks and embeddings."""
    async with async_session() as session:
        # Check chunk count
        query = text("SELECT COUNT(*) FROM message_chunks")
        result = await session.execute(query)
        chunks_count = result.scalar()
        print(f"\nTotal chunks: {chunks_count}")

        # Check embedding count
        query = text("SELECT COUNT(*) FROM message_embeddings")
        result = await session.execute(query)
        embeddings_count = result.scalar()
        print(f"Total embeddings: {embeddings_count}")

        if chunks_count > 0:
            # Get sample chunk with embedding
            query = text("""
                SELECT 
                    c.id as chunk_id,
                    c.message_id,
                    c.chunk_content,
                    c.metadata,
                    e.id as embedding_id,
                    length(e.embedding_vector::text) as vector_length
                FROM message_chunks c
                JOIN message_embeddings e ON e.chunk_id = c.id
                LIMIT 1
            """)
            result = await session.execute(query)
            row = result.mappings().one()
            
            print("\nSample chunk:")
            print(f"Chunk ID: {row['chunk_id']}")
            print(f"Message ID: {row['message_id']}")
            print(f"Content: {row['chunk_content']}")
            print(f"Metadata: {row['metadata']}")
            print(f"Embedding ID: {row['embedding_id']}")
            print(f"Vector length: {row['vector_length']}")

if __name__ == "__main__":
    asyncio.run(check_embeddings()) 