from typing import Optional
import logging
from pydantic import BaseSettings
import os

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    """Application settings."""
    
    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'
        case_sensitive = True
        env_prefix = ''  # No prefix for env vars
        env_nested_delimiter = '__'
    
    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    
    # Database URL
    DATABASE_URL: Optional[str] = None
    TEST_DATABASE_URL: Optional[str] = "postgresql+asyncpg://postgres:postgres@localhost:5432/test_db"
    
    # OpenAI
    OPENAI_API_KEY: str
    
    # Environment
    ENVIRONMENT: str = "development"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Use provided DATABASE_URL if available, otherwise construct from components
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable must be set")

settings = Settings() 