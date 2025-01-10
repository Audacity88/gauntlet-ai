from fastapi import APIRouter
from app.api.endpoints import files, messages

api_router = APIRouter()

api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"]) 