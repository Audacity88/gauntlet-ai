from typing import Optional
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
import os
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='allow'  # Allow extra fields for testing configuration
    )
    
    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    
    # OpenAI Configuration
    OPENAI_API_KEY: str
    
    # JWT Configuration
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days
    
    # Environment
    ENVIRONMENT: str = "development"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        logger.info("Settings initialized")
        logger.info(f"Environment: {self.ENVIRONMENT}")

settings = Settings()