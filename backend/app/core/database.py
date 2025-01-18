from typing import AsyncGenerator
from supabase import Client, create_client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_db() -> Client:
    """Get a Supabase client instance."""
    try:
        # Log configuration
        logger.info(f"Initializing Supabase client with URL: {settings.SUPABASE_URL}")
        logger.info(f"Using service key: {settings.SUPABASE_SERVICE_KEY[:8]}...")
        
        # Use service key for admin access
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        
        # Test the connection with a simple query
        try:
            # Test profiles table
            profiles_test = client.from_("profiles").select("count").limit(1).execute()
            logger.info("Successfully queried profiles table")
            logger.debug(f"Profiles test response: {profiles_test}")
            
            # Test messages table
            messages_test = client.from_("messages").select("count").limit(1).execute()
            logger.info("Successfully queried messages table")
            logger.debug(f"Messages test response: {messages_test}")
            
        except Exception as e:
            logger.error("Database connection test failed")
            logger.error(f"Error type: {type(e).__name__}")
            logger.error(f"Error message: {str(e)}")
            if hasattr(e, 'response'):
                logger.error(f"Response status: {getattr(e.response, 'status_code', None)}")
                logger.error(f"Response text: {getattr(e.response, 'text', None)}")
            logger.exception(e)
            raise
        
        return client
    except Exception as e:
        logger.error("Error initializing Supabase client")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        if hasattr(e, 'response'):
            logger.error(f"Response status: {getattr(e.response, 'status_code', None)}")
            logger.error(f"Response text: {getattr(e.response, 'text', None)}")
        logger.exception(e)
        raise
