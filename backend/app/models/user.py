from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, UUID4, ConfigDict
from enum import Enum
import logging

logger = logging.getLogger(__name__)

class UserStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    AWAY = "away"

# Pydantic Models
class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: UserStatus = UserStatus.OFFLINE
    
class UserCreate(UserBase):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[UserStatus] = None

class User(UserBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime
    last_seen: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @property
    def display_name(self) -> str:
        """Return the display name for the user"""
        return self.full_name or self.username

def get_user_by_username(supabase_client, username: str) -> Optional[User]:
    """Fetch a user by username using the Supabase client"""
    try:
        # Execute synchronously since Supabase Python client doesn't support async
        response = supabase_client.from_("profiles").select("*").eq("username", username).single().execute()
        if response.data:
            # Convert datetime strings to datetime objects
            data = response.data
            if isinstance(data["created_at"], str):
                data["created_at"] = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            if isinstance(data["updated_at"], str):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
            if data.get("last_seen") and isinstance(data["last_seen"], str):
                data["last_seen"] = datetime.fromisoformat(data["last_seen"].replace("Z", "+00:00"))
            return User(**data)
        return None
    except Exception as e:
        logger.error(f"Error fetching user by username: {str(e)}")
        return None

def get_user_by_id(supabase_client, user_id: UUID4) -> Optional[User]:
    """Fetch a user by ID using the Supabase client"""
    try:
        logger.debug(f"Fetching user with ID: {user_id}")
        # Execute synchronously since Supabase Python client doesn't support async
        response = supabase_client.from_("profiles").select("*").eq("id", str(user_id)).single().execute()
        
        logger.debug(f"Supabase response: {response}")
        
        if response.data:
            # Convert datetime strings to datetime objects
            data = response.data
            if isinstance(data["created_at"], str):
                data["created_at"] = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            if isinstance(data["updated_at"], str):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
            if data.get("last_seen") and isinstance(data["last_seen"], str):
                data["last_seen"] = datetime.fromisoformat(data["last_seen"].replace("Z", "+00:00"))
            
            logger.info(f"Found user with ID {user_id}")
            return User(**data)
            
        logger.warning(f"No user found with ID {user_id}")
        return None
        
    except Exception as e:
        logger.error(f"Error fetching user by ID {user_id}: {str(e)}")
        logger.exception(e)
        raise  # Re-raise the exception to be handled by the caller

def update_user(supabase_client, user_id: UUID4, update_data: UserUpdate) -> Optional[User]:
    """Update a user's information using the Supabase client"""
    try:
        # Execute synchronously since Supabase Python client doesn't support async
        response = supabase_client.from_("profiles")\
            .update(update_data.model_dump(exclude_unset=True))\
            .eq("id", str(user_id))\
            .single()\
            .execute()
        if response.data:
            # Convert datetime strings to datetime objects
            data = response.data
            if isinstance(data["created_at"], str):
                data["created_at"] = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            if isinstance(data["updated_at"], str):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
            if data.get("last_seen") and isinstance(data["last_seen"], str):
                data["last_seen"] = datetime.fromisoformat(data["last_seen"].replace("Z", "+00:00"))
            return User(**data)
        return None
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        return None 