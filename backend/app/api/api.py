from fastapi import APIRouter
from app.api.endpoints import files, messages, chat

api_router = APIRouter()

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(
    chat.router,
    prefix="/chat",
    tags=["chat"]
) 