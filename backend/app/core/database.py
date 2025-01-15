from typing import AsyncGenerator
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

print(f"Initializing Supabase client with URL: {supabase_url}")

try:
    # Create client with service role key
    supabase: Client = create_client(
        supabase_url,
        supabase_key
    )

    # Configure the client to use service role
    supabase.postgrest.auth(supabase_key)

    # Test the connection
    test_response = supabase.postgrest\
        .from_("profiles")\
        .select("count")\
        .execute()
    print(f"Database connection test successful: {test_response}")

except Exception as e:
    print(f"Error initializing database client: {str(e)}")
    print(f"Error type: {type(e)}")
    print(f"Error args: {e.args if hasattr(e, 'args') else 'No args'}")
    if hasattr(e, 'response'):
        print(f"Response status: {e.response.status_code if hasattr(e.response, 'status_code') else 'No status'}")
        print(f"Response text: {e.response.text if hasattr(e.response, 'text') else 'No text'}")
    raise

# Set default schema to public
postgrest_client = supabase.postgrest.schema("public")

async def get_db() -> AsyncGenerator[Client, None]:
    """
    Get a database client instance.
    This function returns the Supabase client with service role access.
    """
    try:
        yield supabase
    finally:
        # No need to close the client after each request
        pass 