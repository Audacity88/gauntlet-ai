from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_session
from app.models.user import User
from supabase import create_client, Client

security = HTTPBearer()

def get_supabase() -> Client:
    """Get a Supabase client instance."""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_KEY
    )

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    session: AsyncSession = Depends(get_session)
) -> User:
    """Get the current user from the Supabase JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Get user from database using email
        stmt = select(User).where(User.email == credentials.credentials)
        result = await session.execute(stmt)
        db_user = result.scalar_one_or_none()
        
        if db_user is None:
            raise credentials_exception
            
        return db_user
        
    except Exception as e:
        raise credentials_exception 