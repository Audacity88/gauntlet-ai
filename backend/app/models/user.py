from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, UUID4
from enum import Enum

class UserStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    AWAY = "away"

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

    class Config:
        from_attributes = True

    @property
    def display_name(self) -> str:
        """Return the display name for the user"""
        return self.full_name or self.username

async def get_user_by_username(supabase_client, username: str) -> Optional[User]:
    """Fetch a user by username using the Supabase client"""
    try:
        response = await supabase_client.from_("profiles").select("*").eq("username", username).single().execute()
        if response.data:
            return User(**response.data)
        return None
    except Exception as e:
        print(f"Error fetching user by username: {str(e)}")
        return None

async def get_user_by_id(supabase_client, user_id: UUID4) -> Optional[User]:
    """Fetch a user by ID using the Supabase client"""
    try:
        response = await supabase_client.from_("profiles").select("*").eq("id", str(user_id)).single().execute()
        if response.data:
            return User(**response.data)
        return None
    except Exception as e:
        print(f"Error fetching user by ID: {str(e)}")
        return None

async def update_user(supabase_client, user_id: UUID4, update_data: UserUpdate) -> Optional[User]:
    """Update a user's information using the Supabase client"""
    try:
        response = await supabase_client.from_("profiles")\
            .update(update_data.dict(exclude_unset=True))\
            .eq("id", str(user_id))\
            .single()\
            .execute()
        if response.data:
            return User(**response.data)
        return None
    except Exception as e:
        print(f"Error updating user: {str(e)}")
        return None 