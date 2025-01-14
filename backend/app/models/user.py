from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlalchemy import String, DateTime, Boolean, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB

from app.models.base import Base

class User(Base):
    """User model that matches Supabase's auth.users table."""
    
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}
    
    # Required fields
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), 
        primary_key=True,
        server_default=text("uuid_generate_v4()")
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    raw_user_meta_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    
    # Optional fields
    encrypted_password: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_sign_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
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
    
    # Status
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    @property
    def username(self) -> Optional[str]:
        """Get username from metadata."""
        if self.raw_user_meta_data:
            return self.raw_user_meta_data.get("username")
        return None
    
    @property
    def full_name(self) -> Optional[str]:
        """Get full name from metadata."""
        if self.raw_user_meta_data:
            return self.raw_user_meta_data.get("full_name")
        return None
    
    def __repr__(self) -> str:
        return f"<User {self.id}: {self.email}>" 