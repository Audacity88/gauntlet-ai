import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import logging
import certifi

logger = logging.getLogger(__name__)

# Get database URL from settings
db_url = settings.DATABASE_URL

# Create SSL context with proper certificate verification (uses certifi)
ssl_context = ssl.create_default_context(cafile=certifi.where())

if settings.ENVIRONMENT != "production":
    # Non-production: skip verification entirely (allow self-signed).
    logger.warning("SSL certificate verification disabled for non-production environment")
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
else:
    # Production: enforce certificate verification
    logger.info("SSL certificate verification enabled for production environment")
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED

# Log SSL configuration
logger.debug(f"Using certifi CA bundle at: {certifi.where()}")
logger.debug(f"SSL verify mode: {ssl_context.verify_mode}")
logger.debug(f"SSL check hostname: {ssl_context.check_hostname}")

# Create async engine with SSL context
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=0,
    connect_args={
        "ssl": ssl_context,
        "server_settings": {
            "application_name": "gauntlet-ai"
        },
        "command_timeout": 60
    }
)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Dependency to get database session
async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
