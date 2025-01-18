from typing import Dict, Any, Optional, List
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

class HistoryRequest(BaseModel):
    """Request model for fetching user message history."""
    target_user_id: str = Field(..., description="ID of the user to get history for")
    is_dm: bool = False
    limit: int = Field(default=50, ge=1, le=100, description="Maximum number of messages to return")
    
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

@router.post("/history")
async def get_user_history(
    request: HistoryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    """Get message history for a specific user."""
    try:
<<<<<<< HEAD
        # Get current timestamp for soft delete
        now = datetime.utcnow().isoformat()

        # Update all messages in the channel to be soft deleted
        result = db.from_("direct_messages")\
            .update({"deleted_at": now})\
            .eq("channel_id", str(request.channel_id))\
            .filter("deleted_at", "is", "null")\
            .execute()
=======
        logger.info(f"Fetching history for user {request.target_user_id}")
        history_manager = UserHistoryManager(session)
        
        try:
            messages = await history_manager.get_user_messages(
                user_id=request.target_user_uuid,
                limit=request.limit,
                is_dm=request.is_dm
            )
        except Exception as e:
            logger.error(f"Error in get_user_messages: {str(e)}")
            logger.exception(e)
            raise
        
        logger.info(f"Found {len(messages)} messages")
        
        # Transform messages into the format expected by the frontend
        formatted_messages = []
        try:
            for msg in messages:
                formatted_messages.append({
                    "content": msg["content"],
                    "sender": {
                        "id": str(request.target_user_uuid),
                        "username": msg["metadata"]["username"]
                    },
                    "created_at": msg["metadata"]["timestamp"],
                    "id": msg["metadata"]["message_id"]
                })
        except Exception as e:
            logger.error(f"Error formatting messages: {str(e)}")
            logger.error(f"Message that caused error: {msg}")
            logger.exception(e)
            raise HTTPException(
                status_code=500,
                detail=f"Error formatting messages: {str(e)}"
            )
>>>>>>> 5b6fbe7e4dd5bb01e4c8c5c98fe126e78fe44646
        
        return {
            "messages": formatted_messages,
            "total": len(formatted_messages)
        }
        
    except Exception as e:
        logger.error(f"Error fetching user history: {str(e)}")
        logger.exception(e)
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching user history: {str(e)}"
        ) 