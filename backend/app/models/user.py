from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, UUID4, ConfigDict
from enum import Enum
from sqlalchemy import Column, String, DateTime, Boolean, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base

class UserStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    AWAY = "away"

# SQLAlchemy Model
class UserDB(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    status = Column(SQLAlchemyEnum(UserStatus), default=UserStatus.OFFLINE)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)

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
            .update(update_data.model_dump(exclude_unset=True))\
            .eq("id", str(user_id))\
            .single()\
            .execute()
        if response.data:
            return User(**response.data)
        return None
    except Exception as e:
        print(f"Error updating user: {str(e)}")
        return None 