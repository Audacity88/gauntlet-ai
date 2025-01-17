from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, UUID4, Field
from uuid import UUID, uuid4
from postgrest.exceptions import APIError
from app.core.database import Client
from app.models.chat import get_or_create_dm_channel
from app.models.types import MessageType

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
    user_id: UUID4
    profile_id: UUID4
    inserted_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

async def create_message(
    supabase_client: Client,
    user_id: UUID,
    profile_id: UUID,
    message_data: Union[MessageCreate, Dict[str, Any]]
) -> Optional[Message]:
    """Create a new message"""
    try:
        # Convert Pydantic model to dict if needed
        data = message_data.dict() if hasattr(message_data, 'dict') else message_data
        
        # Determine if this is a direct message
        is_direct = data.get('metadata', {}).get('mode') == 'direct'
        
        # Convert UUIDs in metadata to strings
        metadata = data.get('metadata', {})
        if metadata and 'target_user_id' in metadata:
            metadata['target_user_id'] = str(metadata['target_user_id'])
        
        # Prepare message data
        message_insert = {
            "id": str(uuid4()),
            "channel_id": str(data["channel_id"]) if data.get("channel_id") else None,
            "user_id": str(user_id),
            "profile_id": str(profile_id),
            "content": data["content"],
            "message_type": data.get("message_type", "text"),
            "parent_id": str(data["parent_id"]) if data.get("parent_id") else None,
            "attachments": data.get("attachments"),
            "metadata": metadata,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Use direct_messages table for DMs, messages table for regular messages
        table = "direct_messages" if is_direct else "messages"
        print(f"Creating message in {table} table")
        
        # Insert the message using synchronous query
        response = supabase_client.table(table)\
            .insert(message_insert)\
            .execute()
        
        if response and hasattr(response, 'data') and response.data:
            created_message = response.data[0]
            print(f"Message created successfully in {table}")
            
            # Convert the response data to a Message object
            return Message(
                id=UUID(created_message['id']),
                user_id=UUID(created_message['user_id']),
                profile_id=UUID(created_message['profile_id']),
                content=created_message['content'],
                message_type=MessageType(created_message.get('message_type', 'text')),
                parent_id=UUID(created_message['parent_id']) if created_message.get('parent_id') else None,
                channel_id=UUID(created_message['channel_id']) if created_message.get('channel_id') else None,
                attachments=created_message.get('attachments'),
                metadata=created_message.get('metadata'),
                inserted_at=datetime.fromisoformat(created_message['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(created_message['updated_at'].replace('Z', '+00:00')) if created_message.get('updated_at') else None,
                deleted_at=datetime.fromisoformat(created_message['deleted_at'].replace('Z', '+00:00')) if created_message.get('deleted_at') else None
            )
        else:
            print(f"Error creating message: No data in response")
            return None
            
    except APIError as e:
        print(f"API Error creating message: {e.args[0] if e.args else str(e)}")
        return None
    except Exception as e:
        print(f"Error creating message: {e}")
        return None

async def get_message(
    supabase_client,
    message_id: UUID4
) -> Optional[Message]:
    """Get a message by ID"""
    try:
        response = await supabase_client.from_("messages").select("*").eq("id", str(message_id)).single().execute()
        return Message(**response.data) if response and hasattr(response, 'data') and response.data else None
    except APIError as e:
        print(f"API Error getting message: {e.args[0] if e.args else str(e)}")
        return None
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
        response = await supabase_client.from_("messages")\
            .update(update_data.dict(exclude_unset=True))\
            .eq("id", str(message_id))\
            .eq("profile_id", str(profile_id))\
            .select("*")\
            .single()\
            .execute()
        return Message(**response.data) if response and hasattr(response, 'data') and response.data else None
    except APIError as e:
        print(f"API Error updating message: {e.args[0] if e.args else str(e)}")
        return None
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
        response = await supabase_client.from_("messages")\
            .update({"deleted_at": datetime.utcnow().isoformat()})\
            .eq("id", str(message_id))\
            .eq("profile_id", str(profile_id))\
            .execute()
        return True if response and hasattr(response, 'data') else False
    except APIError as e:
        print(f"API Error deleting message: {e.args[0] if e.args else str(e)}")
        return False
    except Exception as e:
        print(f"Error deleting message: {e}")
        return False

async def get_channel_messages(
    supabase_client,
    channel_id: UUID4,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None
) -> List[Message]:
    """Get messages from a channel with pagination"""
    try:
        query = supabase_client.from_("messages")\
            .select("*")\
            .eq("channel_id", str(channel_id))\
            .is_("deleted_at", "null")\
            .order("inserted_at", desc=True)\
            .limit(limit)
        
        if before_timestamp:
            query = query.lt("inserted_at", before_timestamp.isoformat())
        
        response = await query.execute()
        return [Message(**msg) for msg in response.data] if response and hasattr(response, 'data') and response.data else []
    except APIError as e:
        print(f"API Error getting channel messages: {e.args[0] if e.args else str(e)}")
        return []
    except Exception as e:
        print(f"Error getting channel messages: {e}")
        return []

async def get_thread_messages(
    supabase_client,
    parent_id: UUID4,
    limit: int = 50,
    before_timestamp: Optional[datetime] = None
) -> List[Message]:
    """Get messages in a thread with pagination"""
    try:
        query = supabase_client.from_("messages")\
            .select("*")\
            .eq("parent_id", str(parent_id))\
            .is_("deleted_at", "null")\
            .order("inserted_at", desc=True)\
            .limit(limit)
        
        if before_timestamp:
            query = query.lt("inserted_at", before_timestamp.isoformat())
        
        response = await query.execute()
        return [Message(**msg) for msg in response.data] if response and hasattr(response, 'data') and response.data else []
    except APIError as e:
        print(f"API Error getting thread messages: {e.args[0] if e.args else str(e)}")
        return []
    except Exception as e:
        print(f"Error getting thread messages: {e}")
        return []