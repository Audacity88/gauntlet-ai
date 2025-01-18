import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Chat API",
    description="API for chat functionality with RAG support",
    version="1.0.0"
)

# Configure CORS - make it as permissive as possible for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Include routers
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """Log all registered routes on startup."""
    logger.info("Application starting up...")
    logger.info("Registered routes:")
    for route in app.routes:
        logger.info(f"Route: {route.path} [{route.methods}]")
    logger.info("CORS configuration:")
    logger.info(f"Allow origins: {app.user_middleware[0].options.get('allow_origins')}")
    logger.info(f"Allow methods: {app.user_middleware[0].options.get('allow_methods')}")
    logger.info("Application startup complete") 