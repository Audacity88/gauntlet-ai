from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, UUID4, Field
from enum import Enum

class ChatMode(str, Enum):
    DIRECT = "direct"
    CHANNEL = "channel"
    SYSTEM = "system"

class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class ChatMessage(BaseModel):
    role: ChatRole
    content: str
    metadata: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    content: str
    target_user_id: Optional[UUID4] = None
    channel_id: Optional[UUID4] = None
    message_id: Optional[UUID4] = None
    mode: ChatMode = ChatMode.DIRECT
    metadata: Optional[Dict[str, Any]] = None
    stream: bool = False

class ChatResponse(BaseModel):
    message_id: UUID4
    content: str
    role: ChatRole = ChatRole.ASSISTANT
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

class ChatStreamChunk(BaseModel):
    message_id: UUID4
    content: str
    role: ChatRole = ChatRole.ASSISTANT
    created_at: datetime
    is_complete: bool = False
    metadata: Optional[Dict[str, Any]] = None

class ChatContext(BaseModel):
    messages: List[ChatMessage]
    user_id: UUID4
    target_user_id: Optional[UUID4] = None
    channel_id: Optional[UUID4] = None
    metadata: Optional[Dict[str, Any]] = None

async def format_chat_context(
    supabase_client,
    user_id: UUID4,
    target_user_id: Optional[UUID4] = None,
    channel_id: Optional[UUID4] = None,
    message_id: Optional[UUID4] = None,
    limit: int = 10
) -> ChatContext:
    """Format chat context from message history"""
    try:
        # Start building the query
        query = supabase_client.from_("messages").select("*")\
            .is_("deleted_at", None)\
            .order("inserted_at", desc=True)\
            .limit(limit)
            
        # Add filters based on chat mode
        if channel_id:
            query = query.eq("channel_id", str(channel_id))
        elif target_user_id:
            query = query.or_(
                f'profile_id.eq.{str(user_id)},target_user_id.eq.{str(target_user_id)}',
                f'profile_id.eq.{str(target_user_id)},target_user_id.eq.{str(user_id)}'
            )
            
        # Add message_id filter if provided
        if message_id:
            query = query.lt("id", str(message_id))
            
        # Execute query
        response = await query.execute()
        
        # Convert messages to chat format
        messages = []
        for msg in reversed(response.data):  # Reverse to get chronological order
            role = ChatRole.ASSISTANT if msg["is_assistant"] else ChatRole.USER
            messages.append(ChatMessage(
                role=role,
                content=msg["content"],
                metadata=msg.get("metadata")
            ))
            
        return ChatContext(
            messages=messages,
            user_id=user_id,
            target_user_id=target_user_id,
            channel_id=channel_id,
            metadata={"message_count": len(messages)}
        )
        
    except Exception as e:
        print(f"Error formatting chat context: {e}")
        return ChatContext(
            messages=[],
            user_id=user_id,
            target_user_id=target_user_id,
            channel_id=channel_id,
            metadata={"error": str(e)}
        ) 