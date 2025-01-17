from typing import AsyncGenerator, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User
from app.models.message import create_message, MessageCreate, MessageType, Message
from app.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatStreamChunk,
    format_chat_context,
    ChatMode,
    ChatRole
)
from datetime import datetime
import json
from app.rag.llm import LLMProcessor
from app.core.config import settings
import os
import logging
from pydantic import BaseModel, UUID4
from typing import Dict, Any

logger = logging.getLogger(__name__)

router = APIRouter()

class ClearChannelRequest(BaseModel):
    channel_id: UUID4

class UserSummaryRequest(BaseModel):
    target_user_id: UUID4
    mode: str = "direct"

async def extract_channel_id(channel_response: Any) -> str:
    """Extract channel_id from RPC response"""
    try:
        # The response is a single row with a JSONB object containing channel_id
        if isinstance(channel_response.data, list):
            channel_data = channel_response.data[0]
        else:
            channel_data = channel_response.data
            
        channel_id = channel_data.get('channel_id')
        if not channel_id:
            logger.error(f"Channel response data: {channel_data}")
            raise ValueError("No channel_id in response")
        return str(channel_id)
    except Exception as e:
        logger.error(f"Error extracting channel_id from response: {channel_response.data}")
        raise ValueError(f"Invalid channel response: {str(e)}")

async def get_or_create_dm_channel(db: Client, current_user_id: UUID4, target_user_id: UUID4) -> str:
    """Get or create a DM channel between two users"""
    logger.info("Creating or getting DM channel...")
    try:
        channel_response = db.rpc(
            'find_or_create_dm_channel',
            {
                'p_user_id': str(current_user_id),
                'p_other_user_id': str(target_user_id)
            }
        ).execute()
        logger.info(f"Channel response: {channel_response.data}")

        if not channel_response.data:
            raise ValueError("Failed to get or create DM channel")

        return await extract_channel_id(channel_response)
    except Exception as e:
        logger.error(f"Error in get_or_create_dm_channel: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

async def create_user_message(
    db: Client,
    user_id: UUID4,
    channel_id: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Message:
    """Create a message from a user"""
    try:
        message = await create_message(
            db,
            user_id,  # From user
            user_id,  # Use user's profile_id
            MessageCreate(
                content=content,
                channel_id=channel_id,
                message_type=MessageType.TEXT,
                metadata={
                    "is_user_message": True,
                    **(metadata or {})
                }
            )
        )
        if not message:
            raise ValueError("Could not create user message")
        return message
    except Exception as e:
        logger.error(f"Error creating user message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

async def create_avatar_message(
    db: Client,
    target_user_id: UUID4,
    current_user_id: UUID4,
    channel_id: str,
    content: str,
    llm_response: Dict[str, Any]
) -> Message:
    """Create a message from an avatar"""
    try:
        message = await create_message(
            db,
            target_user_id,  # The avatar's user ID
            target_user_id,  # The avatar's profile ID
            MessageCreate(
                content=content,
                channel_id=channel_id,
                message_type=MessageType.TEXT,
                metadata={
                    "is_avatar_response": True,
                    "is_introduction": True,
                    "model": llm_response.get("model"),
                    "usage": llm_response.get("usage", {})
                }
            )
        )
        if not message:
            raise ValueError("Could not create avatar message")
        return message
    except Exception as e:
        logger.error(f"Error creating avatar message: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/send")
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> ChatResponse:
    """Send a message and get a response"""
    logger.info(f"Processing message request from {current_user.id} to {request.target_user_id}")
    
    try:
        # Get chat context
        context = await format_chat_context(
            db,
            current_user.id,
            request.target_user_id,
            request.channel_id,
            request.message_id
        )
        formatted_messages = context.messages if context else []
        logger.info(f"Chat context retrieved: {context}")
        
        # Get or create DM channel
        channel_id = await get_or_create_dm_channel(db, current_user.id, request.target_user_id)
        logger.info(f"Using channel_id: {channel_id}")

        # Create user's message
        user_message = await create_user_message(
            db, 
            current_user.id, 
            channel_id, 
            request.content,
            request.metadata
        )
        logger.info(f"Created user message: {user_message.id}")

        # Get target user's username for response
        target_user_response = db.from_("profiles").select("username").eq("id", str(request.target_user_id)).single().execute()
        if not target_user_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user profile not found"
            )
        target_username = target_user_response.data["username"]
        logger.info(f"Target username: {target_username}")

        # Generate response using LLM
        llm_processor = LLMProcessor(api_key=settings.OPENAI_API_KEY)
        llm_response = await llm_processor.generate_rag_response(
            query=request.content,
            context=formatted_messages,
            username=target_username
        )
        logger.info("Generated LLM response")

        # Create avatar's response message
        avatar_message = await create_avatar_message(
            db,
            request.target_user_id,
            current_user.id,  # Pass current user's ID for profile_id
            channel_id,
            llm_response["content"],
            llm_response
        )
        logger.info(f"Created avatar message: {avatar_message.id}")

        # Return the avatar's response
        return ChatResponse(
            message_id=avatar_message.id,
            content=avatar_message.content,
            role=ChatRole.ASSISTANT,
            created_at=avatar_message.inserted_at or datetime.utcnow(),
            metadata=avatar_message.metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/user_summary")
async def get_user_summary(
    request: UserSummaryRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> ChatResponse:
    """Get a summary of interactions with a user"""
    logger.info(f"Getting user summary for {request.target_user_id}")
    
    try:
        # Get chat context
        context = await format_chat_context(
            db,
            current_user.id,
            request.target_user_id,
            None,  # No specific channel
            None   # No specific message
        )
        formatted_messages = context.messages if context else []
        logger.info(f"Chat context retrieved: {context}")

        # Get or create DM channel
        channel_id = await get_or_create_dm_channel(db, current_user.id, request.target_user_id)
        logger.info(f"Using channel_id: {channel_id}")

        # Get target user's username
        target_user_response = db.from_("profiles").select("username").eq("id", str(request.target_user_id)).single().execute()
        if not target_user_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user profile not found"
            )
        target_username = target_user_response.data["username"]
        logger.info(f"Target username: {target_username}")

        # Generate summary using LLM
        llm_processor = LLMProcessor(api_key=settings.OPENAI_API_KEY)
        llm_response = await llm_processor.generate_user_summary(
            context=formatted_messages,
            username=target_username
        )
        logger.info("Generated user summary")

        # Create avatar's summary message
        avatar_message = await create_avatar_message(
            db,
            request.target_user_id,
            current_user.id,
            channel_id,
            llm_response["content"],
            llm_response
        )
        logger.info(f"Created summary message: {avatar_message.id}")

        # Return the summary response
        return ChatResponse(
            message_id=avatar_message.id,
            content=avatar_message.content,
            role=ChatRole.ASSISTANT,
            created_at=avatar_message.inserted_at or datetime.utcnow(),
            metadata=avatar_message.metadata
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_user_summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/clear")
async def clear_messages(
    request: ClearChannelRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> dict:
    """Clear all messages in a channel"""
    try:
        # Get current timestamp for soft delete
        now = datetime.utcnow().isoformat()

        # Update all messages in the channel to be soft deleted
        result = db.from_("direct_messages")\
            .update({"deleted_at": now})\
            .eq("channel_id", str(request.channel_id))\
            .filter("deleted_at", "is", "null")\
            .execute()

        return {
            "status": "success",
            "message": "Messages cleared successfully"
        }
    except Exception as e:
        logger.error(f"Error in clear_messages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        ) 