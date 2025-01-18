from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from pydantic import BaseModel, UUID4, Field
from uuid import UUID, uuid4
from postgrest.exceptions import APIError
from app.core.database import Client
from app.models.chat import get_or_create_dm_channel
from app.models.types import MessageType
import logging

logger = logging.getLogger(__name__)

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
        logger.info(f"Creating message with data: {data}")
        
        # Convert UUIDs in metadata to strings
        metadata = data.get('metadata', {})
        if metadata:
            metadata = {
                k: str(v) if isinstance(v, UUID) else v 
                for k, v in metadata.items()
            }
        
        # Prepare message data
        message_insert = {
            "channel_id": str(data["channel_id"]) if data.get("channel_id") else None,
            "user_id": str(user_id),
            "profile_id": str(profile_id),
            "content": data["content"],
            "message_type": data.get("message_type", "text"),
            "parent_id": str(data["parent_id"]) if data.get("parent_id") else None,
            "attachments": data.get("attachments", []),
            "metadata": metadata
        }
        
        logger.info(f"Creating message in direct_messages table")
        logger.info(f"Message data: {message_insert}")
        
        # Insert the message using RPC function for direct messages
        rpc_params = {
            'p_channel_id': message_insert['channel_id'],
            'p_user_id': message_insert['user_id'],
            'p_profile_id': message_insert['profile_id'],
            'p_content': message_insert['content'],
            'p_message_type': message_insert['message_type'],
            'p_parent_id': message_insert['parent_id'],
            'p_attachments': message_insert['attachments'],
            'p_metadata': message_insert['metadata']
        }
        logger.info(f"Calling send_direct_message with params: {rpc_params}")
        
        try:
            response = supabase_client.rpc(
                'send_direct_message',
                rpc_params
            ).execute()
            logger.info(f"RPC response: {response.data if hasattr(response, 'data') else response}")
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Database error creating message: {error_msg}")
            
            # Check if this is a membership error
            if "User is not a member of this channel" in error_msg:
                # Try to add the user as a member first
                try:
                    logger.info("Attempting to add user as channel member...")
                    member_insert = {
                        "channel_id": rpc_params['p_channel_id'],
                        "user_id": rpc_params['p_user_id'],
                        "profile_id": rpc_params['p_profile_id']
                    }
                    supabase_client.from_("direct_message_members").insert(member_insert).execute()
                    
                    # Try sending the message again
                    logger.info("Retrying message send after adding member...")
                    response = supabase_client.rpc(
                        'send_direct_message',
                        rpc_params
                    ).execute()
                except Exception as inner_e:
                    logger.error(f"Error adding member and retrying: {inner_e}")
                    return None
            else:
                return None

        if response and hasattr(response, 'data'):
            # Handle both single object and list responses
            created_message = response.data[0] if isinstance(response.data, list) else response.data
            
            # If we got a channel_id response instead of a message, that means something went wrong
            if isinstance(created_message, dict) and 'channel_id' in created_message and len(created_message) == 1:
                logger.error(f"Received channel_id instead of message: {created_message}")
                return None
                
            logger.info(f"Message created successfully: {created_message}")
            
            # Convert the response data to a Message object
            try:
                return Message(
                    id=UUID(created_message['id']),
                    user_id=UUID(created_message['user_id']),
                    profile_id=UUID(created_message['profile_id']),
                    content=created_message['content'],
                    message_type=MessageType(created_message.get('message_type', 'text')),
                    channel_id=UUID(created_message['channel_id']),
                    parent_id=UUID(created_message['parent_id']) if created_message.get('parent_id') else None,
                    attachments=created_message.get('attachments', []),
                    metadata=created_message.get('metadata', {}),
                    inserted_at=datetime.fromisoformat(created_message['created_at'].replace('Z', '+00:00')),
                    updated_at=datetime.fromisoformat(created_message['updated_at'].replace('Z', '+00:00')) if created_message.get('updated_at') else None
                )
            except Exception as e:
                logger.error(f"Error converting message response to object: {e}")
                logger.error(f"Response data: {created_message}")
                return None
        else:
            logger.error(f"Error creating message: No data in response")
            return None
            
    except Exception as e:
        logger.error(f"Error creating message: {e}")
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