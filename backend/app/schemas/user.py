from pydantic import BaseModel, Field, UUID4, EmailStr, constr
from typing import Optional, List
from datetime import datetime

# Base schemas for shared fields
class ProfileBase(BaseModel):
    username: constr(min_length=3, max_length=50) = Field(
        ...,
        description="Username for display",
        pattern="^[a-zA-Z0-9_-]+$"  # Only allow alphanumeric, underscore, and hyphen
    )
    full_name: Optional[constr(max_length=100)] = Field(
        None,
        description="Full name of the user"
    )
    avatar_url: Optional[str] = Field(
        None,
        description="URL to the user's avatar image"
    )

class UserBase(BaseModel):
    email: EmailStr = Field(
        ...,
        description="User's email address"
    )

# Create schemas for input validation
class ProfileCreate(ProfileBase):
    user_id: UUID4 = Field(
        ...,
        description="ID of the user this profile belongs to"
    )

class UserCreate(UserBase):
    pass

# Response schemas with all fields
class Profile(ProfileBase):
    id: UUID4
    user_id: UUID4
    inserted_at: datetime

    class Config:
        orm_mode = True

class User(UserBase):
    id: UUID4
    inserted_at: datetime
    profiles: List[Profile] = []

    class Config:
        orm_mode = True

# Extended schemas with additional information
class ProfileWithUser(Profile):
    user: User

class UserWithProfiles(User):
    active_profile: Optional[Profile] = Field(
        None,
        description="Currently active profile for the user"
    ) 