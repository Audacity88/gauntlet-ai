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

# CORS configuration
origins = [
    "http://localhost:3000",     # Local development
    "http://localhost:5173",     # Vite default
    "https://chatgenius-nu.vercel.app",  # Vercel production
    "https://chatgenius-git-main-dangilles.vercel.app",  # Vercel preview
    "https://chatgenius-dangilles.vercel.app",  # Vercel custom domain
]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include routers
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    """Log all registered routes and CORS configuration on startup."""
    logger.info("Application starting up...")
    logger.info("Registered routes:")
    for route in app.routes:
        logger.info(f"Route: {route.path} [{route.methods}]")
    
    logger.info("CORS configuration:")
    logger.info(f"Allow origins: {origins}")
    logger.info(f"Allow methods: ['*']")
    logger.info(f"Allow headers: ['*']")
    logger.info(f"Allow credentials: True")
    logger.info("Application startup complete") 