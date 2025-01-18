from typing import Annotated, AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt  # Using python-jwt instead of python-jose
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.database import get_session
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

# JWT configuration
SECRET_KEY = settings.SECRET_KEY  # Use Supabase JWT secret for token validation
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: AsyncSession = Depends(get_session)
) -> User:
    """Get the current user from the token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Log token details for debugging
        logger.debug("Attempting to decode JWT token")
        logger.debug(f"Using secret key: {SECRET_KEY[:10]}...")  # Only log first 10 chars for security
        logger.debug(f"Token: {token[:20]}...")  # Only log first 20 chars for security
        
        # Decode the Supabase JWT token
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            verify=True,
            options={
                "verify_aud": False,  # Disable audience verification
                "verify_signature": True  # Ensure signature verification is enabled
            }
        )
        
        logger.debug(f"JWT payload: {payload}")
        
        # Extract user info from Supabase claims
        sub = payload.get("sub")  # This is the user's UUID in Supabase
        email = payload.get("email")
        
        if not sub:
            # For Supabase tokens, user info might be in different claims
            sub = payload.get("user_id") or payload.get("uid")
            if not sub:
                logger.error("Missing user identifier in JWT payload")
                raise credentials_exception
            
            # Get email from user metadata if available
            user_metadata = payload.get("user_metadata", {})
            email = user_metadata.get("email")
            if not email:
                email = f"{sub}@example.com"  # Fallback email if not provided
            
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise credentials_exception
    
    # Get user from database using Supabase user ID
    stmt = select(User).where(User.id == sub)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        # Create user if they don't exist
        user = User(
            id=sub,
            email=email,
            is_active=True
        )
        session.add(user)
        await session.commit()
        logger.info(f"Created new user with ID {sub}")
    
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a new access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt 