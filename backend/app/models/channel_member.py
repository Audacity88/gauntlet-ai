from datetime import datetime
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base

class ChannelMember(Base):
    """Model for storing channel memberships."""
    
    __tablename__ = "channel_members"
    __table_args__ = {"schema": "public"}
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # Foreign keys
    channel_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("public.channels.id", ondelete="CASCADE"),
        nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False
    )
    profile_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("public.profiles.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Member fields
    role: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="member"
    )
    
    # Timestamps
    inserted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False
    )
    
    # Relationships
    channel = relationship("Channel", backref="channel_members")
    user = relationship("User", backref="channel_memberships")
    profile = relationship("Profile", backref="channel_memberships")
    
    def __repr__(self) -> str:
        return f"<ChannelMember {self.user_id} in {self.channel_id}>" 