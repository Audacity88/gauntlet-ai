from datetime import datetime
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from app.models.base import Base

class Message(Base):
    """Message model for storing chat messages."""
    
    __tablename__ = "messages"
    __table_args__ = {"schema": "public"}
    
    # Primary key
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        primary_key=True,
        server_default=text("uuid_generate_v4()")
    )
    
    # Foreign key to auth.users
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Message content
    content: Mapped[str] = mapped_column(String, nullable=False)
    
    # Optional metadata
    message_metadata: Mapped[dict] = mapped_column(JSONB, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        onupdate=datetime.utcnow,
        nullable=False
    )
    
    # Relationships
    user = relationship("User", backref="messages")
    
    def __repr__(self) -> str:
        return f"<Message {self.id}: {self.content[:50]}...>" 