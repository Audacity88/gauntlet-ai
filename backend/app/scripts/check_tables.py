import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()

async def list_tables():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")

    # Convert postgresql:// to postgresql+asyncpg:// if needed
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(database_url)

    print("Listing all tables...")
    async with engine.begin() as conn:
        result = await conn.execute(text('''
            SELECT schemaname, tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY schemaname, tablename;
        '''))
        tables = result.fetchall()
        
        for schema, table in tables:
            print(f"{schema}.{table}")

if __name__ == "__main__":
    asyncio.run(list_tables()) 