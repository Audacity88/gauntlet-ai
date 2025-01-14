#!/usr/bin/env python3
import asyncio
import os
from datetime import datetime
from typing import List, Dict, Any
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Debug: Print environment before loading .env
print("\nBefore loading .env:")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'Not set')[:4]}... (if set)")

# Load environment variables
load_dotenv()

# Debug: Print environment after loading .env
print("\nAfter loading .env:")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'Not set')[:4]}... (if set)")

from app.core.config import settings
from app.rag import MessageChunker, EmbeddingGenerator, RAGStorage

# Debug: Print settings value
print("\nFrom settings:")
print(f"OPENAI_API_KEY: {settings.OPENAI_API_KEY[:4]}... (if set)")

# Initialize async database engine
# Convert postgresql:// to postgresql+asyncpg://
db_url = settings.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
engine = create_async_engine(db_url)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_all_messages() -> List[Dict[str, Any]]:
    """Fetch all messages from the messages table."""
    async with async_session() as session:
        query = text("""
            SELECT 
                m.id,
                m.content,
                m.channel_id,
                m.user_id,
                m.profile_id,
                m.inserted_at as created_at,
                p.username,
                p.full_name,
                c.slug as channel_name
            FROM messages m
            LEFT JOIN profiles p ON p.id = m.profile_id
            LEFT JOIN channels c ON c.id = m.channel_id
            WHERE m.content IS NOT NULL
              AND m.content != ''
            ORDER BY m.inserted_at DESC
        """)
        result = await session.execute(query)
        return [dict(zip(result.keys(), row)) for row in result]

async def process_messages(
    chunker: MessageChunker,
    embedding_generator: EmbeddingGenerator,
    storage: RAGStorage,
    messages: List[Dict[str, Any]]
):
    """Process messages in batches and store their embeddings."""
    total = len(messages)
    processed = 0
    start_time = datetime.now()

    print(f"Processing {total} messages...")

    for message in messages:
        try:
            # Create metadata
            metadata = {
                "author": message.get("username", "unknown"),
                "full_name": message.get("full_name", ""),
                "timestamp": message["created_at"].isoformat(),
                "channel_name": message.get("channel_name", ""),
                "message_type": "message"
            }

            # Generate chunks
            chunks = chunker.create_chunks(
                text=message["content"],
                metadata=metadata
            )

            if not chunks:
                continue

            # Generate embeddings
            chunk_data = await embedding_generator.generate_embeddings(chunks)

            # Store in database
            await storage.store_chunks(
                chunks=chunk_data,
                message_id=message["id"]
            )

            # Update progress
            processed += 1
            if processed % 10 == 0:  # Changed from 100 to 10 since we have fewer messages
                elapsed = datetime.now() - start_time
                rate = processed / elapsed.total_seconds()
                remaining = (total - processed) / rate if rate > 0 else 0
                
                print(f"Processed {processed}/{total} messages "
                      f"({processed/total*100:.1f}%) - "
                      f"Rate: {rate:.1f} msg/s - "
                      f"ETA: {remaining/60:.1f} minutes")

        except Exception as e:
            print(f"Error processing message {message['id']}: {str(e)}")
            continue

async def main():
    # Initialize components
    chunker = MessageChunker()
    embedding_generator = EmbeddingGenerator(
        api_key=settings.OPENAI_API_KEY
    )
    
    async with async_session() as session:
        storage = RAGStorage(session)
        
        # Get all messages
        messages = await get_all_messages()
        
        if not messages:
            print("No messages found in the database!")
            return
            
        print(f"Found {len(messages)} messages to process")
        
        # Process messages
        await process_messages(
            chunker=chunker,
            embedding_generator=embedding_generator,
            storage=storage,
            messages=messages
        )

if __name__ == "__main__":
    asyncio.run(main()) 