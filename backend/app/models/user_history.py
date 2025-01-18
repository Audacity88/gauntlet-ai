from typing import Dict, Any, List, Optional
from uuid import UUID
import logging
from datetime import datetime
from supabase import Client
from app.models.user import User, get_user_by_id

logger = logging.getLogger(__name__)

class UserHistoryManager:
    """Manages retrieval and formatting of user message history for avatar imitation."""
    
    def __init__(self, supabase_client: Client):
        """Initialize the user history manager."""
        self.client = supabase_client
    
    def get_user_messages(
        self,
        user_id: UUID,
        limit: int = 50,
        before_message_id: Optional[UUID] = None,
        is_dm: bool = False
    ) -> List[Dict[str, Any]]:
        """Retrieve messages from a specific user."""
        try:
            # Get user info
            user = get_user_by_id(self.client, user_id)
            if not user:
                logger.error(f"User with ID {user_id} not found")
                raise ValueError(f"User with ID {user_id} not found")
            
            logger.debug(f"Building query for user {user_id} with limit {limit}")
            # Build message query
            query = self.client.from_("messages").select("*")\
                .eq("user_id", str(user_id))\
                .order("inserted_at", desc=True)\
                .limit(limit)
            
            if before_message_id:
                logger.debug(f"Getting reference message {before_message_id}")
                # Get the timestamp of the reference message
                try:
                    ref_msg = self.client.from_("messages")\
                        .select("inserted_at")\
                        .eq("id", str(before_message_id))\
                        .single()\
                        .execute()
                    
                    if ref_msg.data:
                        query = query.lt("inserted_at", ref_msg.data["inserted_at"])
                        logger.debug(f"Found reference message timestamp: {ref_msg.data['inserted_at']}")
                    else:
                        logger.warning(f"Reference message {before_message_id} not found")
                except Exception as e:
                    logger.error(f"Error getting reference message: {str(e)}")
                    logger.exception(e)
            
            logger.debug("Executing messages query")
            # Execute query synchronously
            response = query.execute()
            
            if not response.data:
                logger.warning(f"No messages found for user {user_id}")
                return []
                
            messages = response.data
            logger.debug(f"Found {len(messages)} messages")
            
            # Format messages
            formatted_messages = []
            for msg in messages:
                try:
                    formatted_msg = {
                        "content": msg["content"],
                        "metadata": {
                            "username": user.username,
                            "timestamp": msg["inserted_at"],
                            "channel": "DM" if is_dm else "channel",
                            "message_id": str(msg["id"])
                        }
                    }
                    formatted_messages.append(formatted_msg)
                except Exception as e:
                    logger.error(f"Error formatting message {msg.get('id')}: {str(e)}")
                    logger.exception(e)
                    continue
            
            logger.info(f"Successfully retrieved and formatted {len(formatted_messages)} messages for user {user_id}")
            return formatted_messages
            
        except ValueError as ve:
            logger.error(f"ValueError in get_user_messages: {str(ve)}")
            raise
        except Exception as e:
            logger.error(f"Error retrieving user messages: {str(e)}")
            logger.exception(e)
            raise
    
    def format_context(self, messages: List[Dict[str, Any]]) -> str:
        """Format messages into a context string for the LLM."""
        if not messages:
            return ""
        
        context_parts = []
        for msg in messages:
            timestamp = datetime.fromisoformat(msg["metadata"]["timestamp"]).strftime("%Y-%m-%d %H:%M")
            channel_info = f"[{msg['metadata']['channel']}]"
            context_parts.append(f"{timestamp} {channel_info} {msg['content']}")
        
        return "\n\n".join(context_parts)
    
    def get_user_context(
        self,
        user_id: UUID,
        message_id: Optional[UUID] = None,
        is_dm: bool = False,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get formatted context from user's message history."""
        try:
            messages = self.get_user_messages(
                user_id=user_id,
                limit=limit,
                before_message_id=message_id,
                is_dm=is_dm
            )
            
            context = self.format_context(messages)
            
            if not messages:
                return {
                    "chunks": []
                }
            
            return {
                "chunks": [{
                    "content": context,
                    "metadata": {
                        "username": messages[0]["metadata"]["username"],
                        "message_count": len(messages)
                    }
                }]
            }
            
        except Exception as e:
            logger.error(f"Error getting user context: {str(e)}")
            raise 