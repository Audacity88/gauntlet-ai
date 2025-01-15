from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, UUID4, Field
from enum import Enum

class MessageType(str, Enum):
    TEXT = "text"
    SYSTEM = "system"
    FILE = "file"

class MessageBase(BaseModel):
    content: str
    message_type: MessageType = MessageType.TEXT
    parent_id: Optional[UUID4] = None
    channel_id: Optional[UUID4] = None
    attachments: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class MessageCreate(MessageBase):
    pass

class MessageUpdate(BaseModel):
    content: Optional[str] = None
    attachments: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class Message(MessageBase):
    id: UUID4
    profile_id: UUID4
    inserted_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

async def create_message(
    supabase_client,
    profile_id: UUID4,
    message_data: MessageCreate
) -> Optional[Message]:
    """Create a new message"""
    try:
        data = {
            "profile_id": str(profile_id),
            "content": message_data.content,
            "message_type": message_data.message_type,
            "parent_id": str(message_data.parent_id) if message_data.parent_id else None,
            "channel_id": str(message_data.channel_id) if message_data.channel_id else None,
            "attachments": message_data.attachments,
            "metadata": message_data.metadata
        }
        
        response = await supabase_client.schema("public").from_("messages").insert(data).select("*").single()
        return Message(**response.data) if response.data else None
    except Exception as e:
        print(f"Error creating message: {e}")
        return None

async def get_message(
    supabase_client,
    message_id: UUID4
) -> Optional[Message]:
    """Get a message by ID"""
    try:
        response = await supabase_client.schema("public").from_("messages").select("*").eq("id", str(message_id)).single()
        return Message(**response.data) if response.data else None
    except Exception as e:
        print(f"Error getting message: {e}")
        return None

async def update_message(
    supabase_client,
    message_id: UUID4,
    profile_id: UUID4,
    update_data: MessageUpdate
) -> Optional[Message]:
    """Update a message"""
    try:
        response = await supabase_client.schema("public").from_("messages")\
            .update(update_data.dict(exclude_unset=True))\
            .eq("id", str(message_id))\
            .eq("profile_id", str(profile_id))\
            .select("*").single()
        return Message(**response.data) if response.data else None
    except Exception as e:
        print(f"Error updating message: {e}")
        return None

async def delete_message(
    supabase_client,
    message_id: UUID4,
    profile_id: UUID4
) -> bool:
    """Soft delete a message"""
    try:
        response = await supabase_client.schema("public").from_("messages")\
            .update({"deleted_at": datetime.utcnow()})\
            .eq("id", str(message_id))\
            .eq("profile_id", str(profile_id))\
            .execute()
        return True
    except Exception as e:
        print(f"Error deleting message: {e}")
        return False