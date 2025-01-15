from datetime import datetime
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.models.base import Base

class Profile(Base):
    """Profile model for storing user profiles."""
    
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}
    
    # Primary key (linked to auth.users)
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True
    )
    
    # Profile fields
    username: Mapped[str] = mapped_column(String, unique=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
    
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
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    user = relationship("User", backref="profile", uselist=False)
    
    def __repr__(self) -> str:
        return f"<Profile {self.username}>" 