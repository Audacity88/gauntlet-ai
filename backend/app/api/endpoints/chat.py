from typing import Dict, Any, Optional
from uuid import UUID
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User
from app.rag.llm import LLMProcessor
from app.models.user_history import UserHistoryManager
from app.core.config import settings
import os

router = APIRouter()
logger = logging.getLogger(__name__)

# Add detailed logging of environment and settings
logger.info("Environment variables:")
logger.info(f"OPENAI_API_KEY from env: {os.environ.get('OPENAI_API_KEY', 'Not set')[:8]}...")
logger.info(f"OPENAI_API_KEY from settings: {settings.OPENAI_API_KEY[:8]}...")
logger.info(f"Environment: {settings.ENVIRONMENT}")

class MessageRequest(BaseModel):
    """Request model for chat messages."""
    content: str
    target_user_id: str = Field(..., description="ID of the user to imitate")
    message_id: Optional[str] = Field(default=None, description="UUID string for message context")
    is_dm: bool = False
    
    @property
    def message_uuid(self) -> Optional[UUID]:
        """Convert message_id string to UUID if present."""
        return UUID(self.message_id) if self.message_id else None
    
    @property
    def target_user_uuid(self) -> UUID:
        """Convert target_user_id string to UUID."""
        return UUID(self.target_user_id)

@router.post("/send")
async def send_message(
    message: MessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    """Send a message and get a response imitating the target user."""
    try:
        # Initialize components
        llm = LLMProcessor(
            api_key=settings.OPENAI_API_KEY,
            model_name="gpt-3.5-turbo-instruct",
            temperature=0.85
        )
        history_manager = UserHistoryManager(session)
        
        # Get user's message history for context
        context_data = await history_manager.get_user_context(
            user_id=message.target_user_uuid,
            message_id=message.message_uuid,
            is_dm=message.is_dm,
            limit=20  # Get more messages for better style understanding
        )
        
        if not context_data["chunks"]:
            raise HTTPException(
                status_code=404,
                detail=f"No message history found for user {message.target_user_id}"
            )
        
        # Use the full context for better style imitation
        context = context_data["chunks"][0]["content"]
        username = context_data["chunks"][0]["metadata"]["username"]
        
        # Generate response
        response = await llm.generate_rag_response(
            query=message.content,
            context=context,
            username=username
        )
        
        return response
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )

@router.post("/stream")
async def stream_message(
    message: MessageRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    """Stream a message response imitating the target user."""
    try:
        # Initialize components
        llm = LLMProcessor(
            api_key=settings.OPENAI_API_KEY,
            model_name="gpt-3.5-turbo-instruct",
            temperature=0.85
        )
        history_manager = UserHistoryManager(session)
        
        # Get user's message history for context
        context_data = await history_manager.get_user_context(
            user_id=message.target_user_uuid,
            message_id=message.message_uuid,
            is_dm=message.is_dm,
            limit=20  # Get more messages for better style understanding
        )
        
        if not context_data["chunks"]:
            raise HTTPException(
                status_code=404,
                detail=f"No message history found for user {message.target_user_id}"
            )
        
        # Use the full context for better style imitation
        context = context_data["chunks"][0]["content"]
        username = context_data["chunks"][0]["metadata"]["username"]
        
        # Generate streaming response
        stream = llm.generate_stream_response(
            query=message.content,
            context=context,
            username=username
        )
        
        return StreamingResponse(
            stream,
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        ) 