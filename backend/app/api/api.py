from fastapi import APIRouter
import logging
from app.api.endpoints import files, messages, chat

logger = logging.getLogger(__name__)

api_router = APIRouter()

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Log available routes
logger.info("Registering API routes:")
for route in chat.router.routes:
    logger.info(f"Chat route: {route.path} [{route.methods}]")

api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["chat"]
) 