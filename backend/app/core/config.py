from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChatGenius"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost/chatgenius"
    REDIS_URL: str = "redis://localhost"
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase Storage Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # anon key for client
    SUPABASE_SERVICE_KEY: str = ""  # service role key for backend
    SUPABASE_STORAGE_BUCKET: str = "message-attachments"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB in bytes
    
    class Config:
        env_file = ".env"

settings = Settings() 