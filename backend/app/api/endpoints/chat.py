from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User
from app.models.message import create_message, MessageCreate
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

router = APIRouter()

@router.post("/send", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> ChatResponse:
    """
    Send a message and get a response that imitates the target user.
    """
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
            current_user.id,  # This is the profile_id since it comes from the User model
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not create message"
            )
            
        # TODO: Generate response using LLM
        # For now, return an echo response
        response_content = f"Echo: {request.content}"
        
        # Create assistant message
        assistant_message = await create_message(
            db,
            current_user.id,  # This is correct since it's the profile_id
            MessageCreate(
                content=response_content,
                channel_id=request.channel_id,
                metadata={
                    "is_assistant": True,
                    "target_user_id": str(current_user.id),
                    "mode": request.mode,
                    **(request.metadata or {})
                }
            )
        )
        
        if not assistant_message:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create assistant response"
            )
            
        return ChatResponse(
            message_id=assistant_message.id,
            content=response_content,
            role=ChatRole.ASSISTANT,
            created_at=assistant_message.inserted_at,
            metadata=assistant_message.metadata
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat request: {str(e)}"
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