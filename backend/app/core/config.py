from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChatGenius"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost/chatgenius"
    REDIS_URL: str = "redis://localhost"
    SECRET_KEY: str = "your-secret-key-here"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    class Config:
        env_file = ".env"

settings = Settings() 