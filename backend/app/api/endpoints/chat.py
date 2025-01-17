from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User
from app.models.message import create_message, MessageCreate, MessageType
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

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/send")
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> ChatResponse:
    """Send a message and get a response"""
    print(f"Processing message request from {current_user.id} to {request.target_user_id}")
    
    # Get chat context
    context = await format_chat_context(
        db,
        current_user.id,
        request.target_user_id,
        request.channel_id,
        request.message_id
    )
    print(f"Chat context retrieved: {context}")
    
    try:
        # Add logging to verify the key at runtime
        logger.info(f"Using OpenAI API key: {settings.OPENAI_API_KEY[:8]}...")
        
        # Prepare metadata
        message_metadata = {
            "mode": request.mode or "direct",  # Default to direct mode
            "message_count": context.metadata.get("message_count", 0) if context.metadata else 0
        }
        
        if request.target_user_id:
            message_metadata["target_user_id"] = str(request.target_user_id)
            
        if request.metadata:
            message_metadata.update(request.metadata)
            
        print(f"Creating user message with metadata: {message_metadata}")
        
        # Create message from target user
        user_message = await create_message(
            db,
            request.target_user_id,  # Message comes from target user
            request.target_user_id,  # Profile ID is also target user
            MessageCreate(
                content=request.content,
                channel_id=context.channel_id,
                message_type=request.message_type or MessageType.TEXT,
                parent_id=request.message_id,
                metadata=message_metadata
            )
        )
        print(f"User message created: {user_message}")
        
        if not user_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not create message"
            )

        # Format context for LLM
        formatted_messages = "\n".join([
            f"{msg.role}: {msg.content}" for msg in context.messages
        ])

        # Get current user's username for response
        current_user_response = db.from_("profiles").select("username").eq("id", str(current_user.id)).single().execute()
        if not current_user_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Current user profile not found"
            )
        current_username = current_user_response.data["username"]

        # Generate response using LLM
        llm_processor = LLMProcessor(api_key=settings.OPENAI_API_KEY)
        llm_response = await llm_processor.generate_rag_response(
            query=request.content,
            context=formatted_messages,
            username=current_username  # Use current user's username
        )

        # Create response message from current user
        avatar_message = await create_message(
            db,
            current_user.id,  # Response comes from current user
            current_user.id,
            MessageCreate(
                content=llm_response["content"],
                channel_id=context.channel_id,
                message_type=request.message_type or MessageType.TEXT,
                parent_id=user_message.id,  # Link to user's message
                metadata={
                    **message_metadata,
                    "is_avatar_response": True,
                    "model": llm_response["model"],
                    "usage": llm_response["usage"]
                }
            )
        )
        
        if not avatar_message:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create avatar response"
            )
            
        # Return the avatar's response
        return ChatResponse(
            message_id=avatar_message.id,
            content=avatar_message.content,
            role=ChatRole.ASSISTANT,
            created_at=avatar_message.inserted_at or datetime.utcnow(),
            metadata=avatar_message.metadata
        )
            
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/stream")
async def stream_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> StreamingResponse:
    """
    Send a message and get a streaming response that imitates the target user.
    """
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            # Get chat context
            context = await format_chat_context(
                db,
                current_user.id,
                request.target_user_id,
                request.channel_id,
                request.message_id
            )
            
            # Create user message
            user_message = await create_message(
                db,
                current_user.id,
                MessageCreate(
                    content=request.content,
                    channel_id=request.channel_id,
                    metadata={
                        "target_user_id": str(request.target_user_id) if request.target_user_id else None,
                        "mode": request.mode,
                        **(request.metadata or {})
                    }
                )
            )
            
            if not user_message:
                yield json.dumps({
                    "error": "Could not create message",
                    "status_code": status.HTTP_400_BAD_REQUEST
                })
                return
                
            # TODO: Generate streaming response using LLM
            # For now, stream the echo response word by word
            response_content = f"Echo: {request.content}"
            words = response_content.split()
            
            # Create initial assistant message
            assistant_message = await create_message(
                db,
                current_user.id,  # We'll update this with the bot's ID later
                MessageCreate(
                    content="",  # Start empty, will be updated as we stream
                    channel_id=request.channel_id,
                    metadata={
                        "is_assistant": True,
                        "target_user_id": str(current_user.id),
                        "mode": request.mode,
                        "streaming": True,
                        **(request.metadata or {})
                    }
                )
            )
            
            if not assistant_message:
                yield json.dumps({
                    "error": "Could not create assistant response",
                    "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
                })
                return
                
            # Stream each word
            current_content = ""
            for i, word in enumerate(words):
                current_content = f"{current_content} {word}".strip()
                chunk = ChatStreamChunk(
                    message_id=assistant_message.id,
                    content=current_content,
                    role=ChatRole.ASSISTANT,
                    created_at=datetime.utcnow(),
                    is_complete=(i == len(words) - 1),
                    metadata={
                        "word_index": i,
                        "total_words": len(words)
                    }
                )
                yield json.dumps(chunk.dict()) + "\n"
                
            # Update the final message content
            await db.from_("messages")\
                .update({"content": current_content})\
                .eq("id", str(assistant_message.id))\
                .execute()
                
        except Exception as e:
            yield json.dumps({
                "error": f"Error processing chat request: {str(e)}",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
            })
            
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream"
    ) 