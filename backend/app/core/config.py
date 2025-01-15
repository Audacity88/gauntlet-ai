from typing import Optional
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ConfigDict
import os
from urllib.parse import urlparse, parse_qs, urlencode

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='allow',
        env_prefix='',  # No prefix for env vars
        env_nested_delimiter='__',
        env_file_override=True  # .env file takes precedence over environment variables
    )

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Public anon key
    SUPABASE_SERVICE_KEY: str  # Secret service key for admin operations

    # Database Configuration
    DATABASE_URL: str

    # OpenAI Configuration
    OPENAI_API_KEY: str

    # Environment
    ENVIRONMENT: str = "development"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Convert database URL to use asyncpg
        original_url = self.DATABASE_URL

        # Parse the URL
        parsed = urlparse(original_url)
        query_params = parse_qs(parsed.query)

        # Remove sslmode from query parameters if present
        if 'sslmode' in query_params:
            del query_params['sslmode']

        # Reconstruct the URL without sslmode
        clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if query_params:
            clean_url += "?" + urlencode({k: v[0] for k, v in query_params.items()}, quote_via=lambda x,*_: x)

        # Convert to asyncpg format if needed
        if clean_url.startswith(('postgres://', 'postgresql://')):
            self.DATABASE_URL = clean_url.replace('postgres://', 'postgresql+asyncpg://', 1)
            self.DATABASE_URL = self.DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://', 1)
            logger.info(f"Database URL converted to asyncpg format")
            logger.debug(f"Original URL: {original_url}")
            logger.debug(f"Final URL: {self.DATABASE_URL}")
        else:
            self.DATABASE_URL = clean_url

        logger.info("Settings initialized")
        logger.info(f"Environment: {self.ENVIRONMENT}")

settings = Settings()
