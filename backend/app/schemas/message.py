from pydantic import BaseModel, Field, UUID4, constr
from typing import Optional, List
from datetime import datetime

# Base schemas for shared fields
class MessageBase(BaseModel):
    content: constr(min_length=1, max_length=10000) = Field(..., description="Message content")
    user_id: UUID4 = Field(..., description="ID of the user who sent the message")
    profile_id: UUID4 = Field(..., description="ID of the profile used to send the message")

class DirectMessageBase(BaseModel):
    content: constr(min_length=1, max_length=10000) = Field(..., description="Message content")
    sender_id: UUID4 = Field(..., description="ID of the user who sent the message")
    recipient_id: UUID4 = Field(..., description="ID of the user who receives the message")
    profile_id: UUID4 = Field(..., description="ID of the profile used to send the message")

# Create schemas for input validation
class MessageCreate(MessageBase):
    pass

class DirectMessageCreate(DirectMessageBase):
    pass

# Attachment base schemas
class MessageAttachmentBase(BaseModel):
    filename: str = Field(..., description="Original filename")
    file_path: str = Field(..., description="Path in storage where file is saved")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME type of the file")

class MessageAttachmentCreate(MessageAttachmentBase):
    pass

# Response schemas with all fields
class MessageAttachment(MessageAttachmentBase):
    id: UUID4
    message_id: UUID4
    inserted_at: datetime

    class Config:
        orm_mode = True

class Message(MessageBase):
    id: UUID4
    channel_id: UUID4
    inserted_at: datetime
    attachments: List[MessageAttachment] = []

    class Config:
        orm_mode = True

class DirectMessage(DirectMessageBase):
    id: UUID4
    inserted_at: datetime

    class Config:
        orm_mode = True

# Extended schemas with user information
class MessageWithUser(Message):
    user: dict  # User information will be included here
    profile: dict  # Profile information will be included here

class DirectMessageWithUser(DirectMessage):
    sender: dict  # Sender information will be included here
    recipient: dict  # Recipient information will be included here
    profile: dict  # Profile information will be included here 