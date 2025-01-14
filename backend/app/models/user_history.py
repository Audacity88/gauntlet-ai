from typing import Dict, Any, List, Optional
from uuid import UUID
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)

class UserHistoryManager:
    """Manages retrieval and formatting of user message history for avatar imitation."""
    
    def __init__(self, session: AsyncSession):
        """Initialize the user history manager."""
        self.session = session
    
    async def get_user_messages(
        self,
        user_id: UUID,
        limit: int = 50,
        before_message_id: Optional[UUID] = None,
        is_dm: bool = False
    ) -> List[Dict[str, Any]]:
        """Retrieve messages from a specific user."""
        try:
            # Get user info
            user_query = select(User).where(User.id == user_id)
            user_result = await self.session.execute(user_query)
            user = user_result.scalar_one_or_none()
            
            if not user:
                raise ValueError(f"User with ID {user_id} not found")
            
            # Build message query
            query = (
                select(Message)
                .where(Message.user_id == user_id)
                .order_by(Message.created_at.desc())
                .limit(limit)
            )
            
            if before_message_id:
                message_query = select(Message).where(Message.id == before_message_id)
                message_result = await self.session.execute(message_query)
                message = message_result.scalar_one_or_none()
                if message:
                    query = query.where(Message.created_at < message.created_at)
            
            # Execute query
            result = await self.session.execute(query)
            messages = result.scalars().all()
            
            # Format messages
            formatted_messages = []
            for msg in messages:
                formatted_messages.append({
                    "content": msg.content,
                    "metadata": {
                        "username": user.username,
                        "timestamp": msg.created_at.isoformat(),
                        "channel": "DM" if is_dm else "channel",
                        "message_id": str(msg.id)
                    }
                })
            
            return formatted_messages
            
        except Exception as e:
            logger.error(f"Error retrieving user messages: {str(e)}")
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
    
    async def get_user_context(
        self,
        user_id: UUID,
        message_id: Optional[UUID] = None,
        is_dm: bool = False,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get formatted context from user's message history."""
        try:
            messages = await self.get_user_messages(
                user_id=user_id,
                limit=limit,
                before_message_id=message_id,
                is_dm=is_dm
            )
            
            context = self.format_context(messages)
            
            return {
                "chunks": [{
                    "content": context,
                    "metadata": {
                        "username": messages[0]["metadata"]["username"] if messages else "unknown",
                        "message_count": len(messages)
                    }
                }] if context else []
            }
            
        except Exception as e:
            logger.error(f"Error getting user context: {str(e)}")
            raise 