from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, UUID4, Field
from uuid import UUID
from postgrest.exceptions import APIError
from app.core.database import Client
from app.models.types import MessageType, ChatMode, ChatRole

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
    message_type: Optional[MessageType] = None
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

def convert_to_chat_message(db_message: Dict[str, Any]) -> ChatMessage:
    """Convert a database message to a ChatMessage object"""
    # Extract profile info if available
    profile_info = {}
    if 'profiles' in db_message and db_message['profiles']:
        profile_info = {
            'username': db_message['profiles'].get('username'),
            'full_name': db_message['profiles'].get('full_name'),
            'avatar_url': db_message['profiles'].get('avatar_url')
        }
    
    # Create metadata with message details and profile info
    metadata = {
        'id': db_message.get('id'),
        'created_at': db_message.get('created_at'),
        'message_type': db_message.get('message_type', 'text'),
        'channel_id': db_message.get('channel_id'),
        'user_id': db_message.get('user_id'),
        **profile_info
    }
    
    return ChatMessage(
        role=ChatRole.USER,  # All messages in DMs are from users
        content=db_message.get('content', ''),
        metadata=metadata
    )

async def get_or_create_dm_channel(
    supabase_client: Client,
    user_id: UUID,
    target_user_id: UUID
) -> Optional[UUID]:
    """Get or create a DM channel between two users"""
    print(f"Finding or creating DM channel between {user_id} and {target_user_id}")
    
    try:
        # Use the RPC function that handles both finding and creating the channel
        channel_response = await supabase_client.rpc(
            'find_or_create_dm_channel',
            {
                'p_user_id': str(user_id),
                'p_other_user_id': str(target_user_id)
            }
        ).execute()
        channel_data = channel_response.data if hasattr(channel_response, 'data') else channel_response
        print(f"Raw channel response: {channel_data}")
        
    except APIError as e:
        # The APIError contains the successful response as its first argument
        channel_data = e.args[0] if e.args else None
        print(f"Got channel response from APIError: {channel_data}")
        
        # If channel_data is a string representation of a dict, parse it
        if isinstance(channel_data, str) and channel_data.startswith('{') and channel_data.endswith('}'):
            import ast
            try:
                channel_data = ast.literal_eval(channel_data)
                print(f"Parsed channel data: {channel_data}")
            except:
                print(f"Failed to parse channel data string: {channel_data}")
                return None
        
    except Exception as e:
        print(f"Error creating DM channel: {e}")
        return None
        
    # Process the channel data - both APIError and success cases return same format
    if isinstance(channel_data, dict) and 'channel_id' in channel_data:
        try:
            channel_id = UUID(str(channel_data['channel_id']))
            print(f"Successfully got channel ID: {channel_id}")
            return channel_id
                
        except ValueError as e:
            print(f"Invalid UUID format for channel_id: {e}")
            return None
    else:
        print(f"Channel response missing channel_id: {channel_data}")
        print(f"Channel data type: {type(channel_data)}")
        print(f"Channel data keys: {channel_data.keys() if isinstance(channel_data, dict) else 'Not a dict'}")
        return None

async def format_chat_context(
    supabase_client: Client,
    user_id: UUID,
    target_user_id: Optional[UUID] = None,
    channel_id: Optional[UUID] = None,
    message_id: Optional[UUID] = None,
    limit: int = 50
) -> 'ChatContext':
    """Format chat context for a conversation"""
    messages = []
    dm_channel_id = None
    error_msg = None
    
    if channel_id:
        try:
            # Get messages from the channel
            response = await supabase_client.from_("messages")\
                .select("*")\
                .eq("channel_id", str(channel_id))\
                .is_("deleted_at", "null")\
                .order("inserted_at", desc=True)\
                .limit(limit)\
                .execute()
                
            if hasattr(response, 'data') and response.data:
                messages = [convert_to_chat_message(msg) for msg in response.data]
                print(f"Found {len(messages)} messages in channel")
            else:
                print("No messages found in channel")
                
        except Exception as e:
            error_msg = f"Error getting channel messages: {e}"
            print(error_msg)
            
    elif target_user_id:
        # For DMs, get or create the channel
        dm_channel_id = await get_or_create_dm_channel(supabase_client, user_id, target_user_id)
        if dm_channel_id:
            try:
                # Get messages from the direct_messages table with profile info using synchronous query
                response = supabase_client.table('direct_messages')\
                    .select('*, profiles(username, full_name, avatar_url)')\
                    .eq('channel_id', str(dm_channel_id))\
                    .is_('deleted_at', 'null')\
                    .order('created_at', desc=True)\
                    .limit(limit)\
                    .execute()
                
                if hasattr(response, 'data'):
                    # Convert database messages to ChatMessage objects
                    messages = [convert_to_chat_message(msg) for msg in response.data]
                    print(f"Found {len(messages)} direct messages")
                else:
                    print("No direct messages found or invalid response format")
                    messages = []
                    
            except APIError as e:
                error_msg = f"Error getting DM messages: {e.args[0] if e.args else str(e)}"
                print(error_msg)
                messages = []
            except Exception as e:
                error_msg = f"Error getting DM messages: {e}"
                print(error_msg)
                messages = []
        else:
            error_msg = "Could not create or get DM channel"
            print(error_msg)
            messages = []
            
    # Return context with messages and metadata
    return ChatContext(
        messages=messages,
        user_id=user_id,
        target_user_id=target_user_id,
        channel_id=dm_channel_id if dm_channel_id else channel_id,
        metadata={"message_count": len(messages)} if not error_msg else {"message_count": len(messages), "error": error_msg}
    ) 