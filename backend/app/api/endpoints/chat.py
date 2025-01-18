from typing import Dict, Any, Optional, List, Annotated
from uuid import UUID
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from supabase import Client
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User, get_user_by_id
from app.rag.llm import LLMProcessor
from app.models.user_history import UserHistoryManager
from app.core.config import settings
import os
import json

router = APIRouter()
logger = logging.getLogger(__name__)

# Add detailed logging of environment and settings
logger.info("Environment variables:")
logger.info(f"OPENAI_API_KEY from env: {os.environ.get('OPENAI_API_KEY', 'Not set')[:8]}...")
logger.info(f"OPENAI_API_KEY from settings: {settings.OPENAI_API_KEY[:8]}...")
logger.info(f"Environment: {settings.ENVIRONMENT}")

class UserSummaryRequest(BaseModel):
    """Request model for user summary."""
    target_user_id: str = Field(..., description="ID of the user to get summary for")
    
    @property
    def target_user_uuid(self) -> UUID:
        """Convert target_user_id string to UUID."""
        return UUID(self.target_user_id)

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

@router.post("/user_summary")
@router.options("/user_summary")
def get_user_summary(
    request: UserSummaryRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Client, Depends(get_db)]
) -> Dict[str, Any]:
    """Get a summary of the target user's profile and recent activity."""
    logger.info(f"Processing user summary request for target_user_id: {request.target_user_id}")
    try:
        # Get user profile
        target_user = get_user_by_id(db, request.target_user_uuid)
        if not target_user:
            logger.warning(f"User not found: {request.target_user_id}")
            raise HTTPException(
                status_code=404,
                detail=f"User {request.target_user_id} not found"
            )
            
        # Get user's recent messages
        history_manager = UserHistoryManager(db)
        messages = history_manager.get_user_messages(
            user_id=request.target_user_uuid,
            limit=10,  # Get last 10 messages
            is_dm=False
        )
        
        response_data = {
            "user": {
                "id": str(target_user.id),
                "username": target_user.username,
                "full_name": target_user.full_name,
                "status": target_user.status,
                "last_seen": target_user.last_seen,
                "avatar_url": target_user.avatar_url
            },
            "recent_messages": [
                {
                    "content": msg["content"],
                    "created_at": msg["metadata"]["timestamp"],
                    "id": msg["metadata"]["message_id"]
                }
                for msg in messages
            ] if messages else []
        }
        
        logger.info(f"Successfully retrieved user summary for {request.target_user_id}")
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user summary: {str(e)}")
        logger.exception(e)
        raise HTTPException(
            status_code=500,
            detail=f"Error getting user summary: {str(e)}"
        )

@router.post("/send")
async def send_message(
    message: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> Dict[str, Any]:
    """Send a message and get a response imitating the target user."""
    try:
        logger.info(f"Processing message request for target_user_id: {message.target_user_id}")
        logger.debug(f"Message content: {message.content}")
        
        # First, get or create a DM channel
        try:
            channel_response = db.rpc(
                'find_or_create_dm_channel',
                {
                    'p_user_id': str(current_user.id),
                    'p_other_user_id': message.target_user_id
                }
            ).execute()
            
            if not channel_response.data:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create or find DM channel"
                )
            
            channel_id = channel_response.data.get('channel_id')
            logger.info(f"Using DM channel: {channel_id}")
            
        except Exception as e:
            logger.error(f"Error creating/finding DM channel: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error creating/finding DM channel: {str(e)}"
            )
        
        # Store the user's message
        try:
            # Get the target user's profile ID for the sender's message
            target_profile_response = db.from_('profiles').select('id').eq('id', message.target_user_id).execute()
            if not target_profile_response.data:
                raise HTTPException(
                    status_code=404,
                    detail="Target user profile not found"
                )
            target_profile_id = target_profile_response.data[0]['id']
            
            user_message_data = {
                'channel_id': channel_id,
                'user_id': str(current_user.id),
                'profile_id': target_profile_id,  # Use target's profile ID
                'content': message.content,
                'message_type': 'text',
                'metadata': {'source': 'user'}
            }
            
            user_message_response = db.from_('direct_messages').insert(user_message_data).execute()
            if not user_message_response:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to store user message"
                )
            
            logger.info("Stored user message successfully")
            
        except Exception as e:
            logger.error(f"Error storing user message: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error storing user message: {str(e)}"
            )
        
        # Initialize components for AI response
        llm = LLMProcessor(
            api_key=settings.OPENAI_API_KEY,
            model_name="gpt-3.5-turbo-instruct",
            temperature=0.85
        )
        history_manager = UserHistoryManager(db)
        
        # Get user's message history for context
        try:
            context_data = history_manager.get_user_context(
                user_id=message.target_user_uuid,
                message_id=message.message_uuid,
                is_dm=message.is_dm,
                limit=20  # Get more messages for better style understanding
            )
            logger.debug(f"Retrieved context data: {json.dumps(context_data, indent=2)}")
        except Exception as e:
            logger.error(f"Error getting user context: {str(e)}")
            logger.exception(e)
            raise HTTPException(
                status_code=500,
                detail=f"Error getting user context: {str(e)}"
            )
        
        if not context_data["chunks"]:
            logger.warning(f"No message history found for user {message.target_user_id}")
            raise HTTPException(
                status_code=404,
                detail=f"No message history found for user {message.target_user_id}"
            )
        
        # Use the full context for better style imitation
        context = context_data["chunks"][0]["content"]
        username = context_data["chunks"][0]["metadata"]["username"]
        
        # Generate AI response
        try:
            response = await llm.generate_rag_response(
                query=message.content,
                context=context,
                username=username
            )
            logger.info("Successfully generated AI response")
            logger.debug(f"Response data: {json.dumps(response, indent=2)}")
            
            # Get the current user's profile ID for the AI's response
            current_profile_response = db.from_('profiles').select('id').eq('id', current_user.id).execute()
            if not current_profile_response.data:
                raise HTTPException(
                    status_code=404,
                    detail="Current user profile not found"
                )
            current_profile_id = current_profile_response.data[0]['id']
            
            # Store the AI's response
            ai_message_data = {
                'channel_id': channel_id,
                'user_id': message.target_user_id,
                'profile_id': current_profile_id,  # Use sender's profile ID
                'content': response["content"],
                'message_type': 'text',
                'metadata': {
                    'model': response.get('model'),
                    'usage': response.get('usage'),
                    'source': 'ai'
                }
            }
            
            ai_message_response = db.from_('direct_messages').insert(ai_message_data).execute()
            if not ai_message_response:
                logger.error("Failed to store AI response message")
                # Don't raise an exception here, still return the response to the user
            else:
                logger.info("Stored AI response successfully")
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating or storing AI response: {str(e)}")
            logger.exception(e)
            raise HTTPException(
                status_code=500,
                detail=f"Error generating or storing AI response: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        logger.exception(e)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )

@router.post("/stream")
def stream_message(
    message: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> StreamingResponse:
    """Stream a message response imitating the target user."""
    try:
        # Initialize components
        llm = LLMProcessor(
            api_key=settings.OPENAI_API_KEY,
            model_name="gpt-3.5-turbo-instruct",
            temperature=0.85
        )
        history_manager = UserHistoryManager(db)
        
        # Get user's message history for context
        context_data = history_manager.get_user_context(
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
    db: Client = Depends(get_db)
) -> Dict[str, Any]:
    """Get message history for a specific user."""
    try:
        logger.info(f"Fetching history for user {request.target_user_id}")
        history_manager = UserHistoryManager(db)
        
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
        for msg in messages:
            formatted_messages.append({
                "content": msg["content"],
                "timestamp": msg["metadata"]["timestamp"],
                "id": msg["metadata"]["message_id"],
                "username": msg["metadata"]["username"]
            })
        
        return {
            "messages": formatted_messages,
            "total": len(formatted_messages)
        }
        
    except Exception as e:
        logger.error(f"Error getting user history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting user history: {str(e)}"
        ) 