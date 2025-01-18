from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client:
    """Get a configured Supabase client."""
    try:
        # Use service key for admin access
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        logger.info(f"Creating Supabase client with URL: {settings.SUPABASE_URL}")
        return client
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {str(e)}")
        logger.exception(e)
        raise 