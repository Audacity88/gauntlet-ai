from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from uuid import uuid4

from app.models.base import Base

class Channel(Base):
    __tablename__ = "channels"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    slug = Column(String, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id"), nullable=False)
    inserted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    messages = relationship("Message", back_populates="channel")
    members = relationship("ChannelMember", back_populates="channel")
    creator = relationship("User", foreign_keys=[created_by])

class ChannelMember(Base):
    __tablename__ = "channel_members"
    __table_args__ = {"schema": "public"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("public.channels.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default="member")
    inserted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    channel = relationship("Channel", back_populates="members")
    user = relationship("User", back_populates="channel_memberships")
    profile = relationship("Profile", back_populates="channel_memberships") 