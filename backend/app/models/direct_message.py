from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.models.base import Base

class DirectMessageChannel(Base):
    __tablename__ = "direct_message_channels"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    members = relationship("DirectMessageMember", back_populates="channel", cascade="all, delete-orphan")
    messages = relationship("DirectMessage", back_populates="channel", cascade="all, delete-orphan")

class DirectMessageMember(Base):
    __tablename__ = "direct_message_members"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("public.direct_message_channels.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    last_read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    channel = relationship("DirectMessageChannel", back_populates="members")
    user = relationship("User", back_populates="direct_message_memberships")
    profile = relationship("Profile", back_populates="direct_message_memberships")

class DirectMessage(Base):
    __tablename__ = "direct_messages"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("public.direct_message_channels.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    channel = relationship("DirectMessageChannel", back_populates="messages")
    user = relationship("User", back_populates="direct_messages")
    profile = relationship("Profile", back_populates="direct_messages")
    attachments = relationship("DirectMessageAttachment", back_populates="message", cascade="all, delete-orphan")

class DirectMessageAttachment(Base):
    __tablename__ = "direct_message_attachments"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    direct_message_id = Column(UUID(as_uuid=True), ForeignKey("public.direct_messages.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String, nullable=False)
    inserted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    message = relationship("DirectMessage", back_populates="attachments") 