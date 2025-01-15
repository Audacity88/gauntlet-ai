from datetime import datetime
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base

class Channel(Base):
    """Channel model for storing chat channels."""
    
    __tablename__ = "channels"
    __table_args__ = {"schema": "public"}
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()")
    )
    
    # Channel fields
    slug: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Timestamps
    inserted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False
    )
    
    # Relationships
    creator = relationship("User", backref="created_channels")
    members = relationship("User", secondary="public.channel_members", backref="channels")
    
    def __repr__(self) -> str:
        return f"<Channel {self.slug}>" 