from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.models.base import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String, unique=True, nullable=False)

    # Relationships
    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user")
    channel_memberships = relationship("ChannelMember", back_populates="user")
    direct_messages = relationship("DirectMessage", back_populates="user")
    direct_message_memberships = relationship("DirectMessageMember", back_populates="user")

class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True)
    username = Column(Text, unique=True)
    full_name = Column(Text)
    avatar_url = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="profiles")
    messages = relationship("Message", back_populates="profile")
    direct_messages = relationship("DirectMessage", back_populates="profile")
    channel_memberships = relationship("ChannelMember", back_populates="profile")
    direct_message_memberships = relationship("DirectMessageMember", back_populates="profile") 