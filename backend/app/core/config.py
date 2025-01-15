from typing import Optional
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ConfigDict
import os

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
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str  # Required - must be set from environment
    SUPABASE_DB_URL: Optional[str] = None  # Direct database connection URL
    
    # Database URL
    DATABASE_URL: Optional[str] = None
    TEST_DATABASE_URL: Optional[str] = "postgresql+asyncpg://postgres:postgres@localhost:5432/test_db"
    
    # OpenAI
    OPENAI_API_KEY: str
    
    # JWT Settings
    SECRET_KEY: str = None  # Will be set to SUPABASE_JWT_SECRET in __init__
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Environment
    ENVIRONMENT: str = "development"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Set SECRET_KEY to SUPABASE_JWT_SECRET
        if not self.SUPABASE_JWT_SECRET:
            raise ValueError("SUPABASE_JWT_SECRET environment variable must be set")
        self.SECRET_KEY = self.SUPABASE_JWT_SECRET
        
        # Use provided DATABASE_URL if available, otherwise construct from components
        if self.DATABASE_URL:
            db_url = self.DATABASE_URL
        elif self.SUPABASE_DB_URL:
            db_url = self.SUPABASE_DB_URL
        else:
            # Use local database for development
            db_url = self.TEST_DATABASE_URL
            
        # Add asyncpg driver if not present
        if not "+" in db_url.split("://")[0]:
            protocol = db_url.split("://")[0]
            rest = db_url.split("://")[1]
            db_url = f"{protocol}+asyncpg://{rest}"
            
        # Remove any existing SSL mode parameter
        if "?sslmode=" in db_url:
            db_url = db_url.split("?sslmode=")[0]
        elif "&sslmode=" in db_url:
            db_url = db_url.split("&sslmode=")[0]
            
        # Clean up the URL and ensure no spaces
        self.DATABASE_URL = db_url.replace(" ", "").strip()
        
        logger.info("Settings initialized")
        logger.info(f"Environment: {self.ENVIRONMENT}")
        logger.info(f"Database URL: {self.DATABASE_URL}")
        logger.info(f"Supabase URL: {self.SUPABASE_URL if self.SUPABASE_URL else 'Not set'}")

settings = Settings() 