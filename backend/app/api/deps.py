from typing import Annotated, AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt  # Using python-jwt instead of python-jose
from datetime import datetime, timedelta
from app.core.config import settings
from app.models.user import User
from app.core.supabase import get_supabase_client
import logging
import base64

logger = logging.getLogger(__name__)

def get_jwt_secret():
    """Get JWT secret and encode it to bytes"""
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        logger.error("SUPABASE_JWT_SECRET is not set")
        return None
        
    # Since we know the secret is a plain string, just encode it to bytes
    if isinstance(secret, str):
        return secret.encode('utf-8')
    return secret

# JWT configuration
JWT_SECRET = get_jwt_secret()  # Use Supabase JWT secret for token validation
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)]
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
        logger.debug(f"Using JWT secret (first 5 bytes): {JWT_SECRET[:5] if JWT_SECRET else 'None'}...")
        logger.debug(f"Token: {token[:20]}...")
        
        # First try to decode without verification for debugging
        try:
            parts = token.split('.')
            if len(parts) == 3:
                header = base64.urlsafe_b64decode(parts[0] + "=" * (-len(parts[0]) % 4))
                payload_raw = base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4))
                logger.debug(f"Token header: {header.decode('utf-8')}")
                logger.debug(f"Raw payload: {payload_raw.decode('utf-8')}")
        except Exception as e:
            logger.warning(f"Failed to decode token parts: {e}")
        
        # Decode the Supabase JWT token with minimal verification
        payload = jwt.decode(
            token, 
            JWT_SECRET, 
            algorithms=[ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,  # Supabase includes this
                "verify_iss": True,  # Supabase includes this
                "verify_sub": True,  # Supabase includes this
                "require": ["exp", "aud", "iss", "sub"]
            },
            audience="authenticated",  # Supabase uses this audience
            issuer=f"{settings.SUPABASE_URL}/auth/v1"  # Supabase uses this issuer
        )
        
        logger.debug(f"JWT payload: {payload}")
        
        # Extract user info from Supabase claims
        sub = payload.get("sub")
        if not sub:
            logger.error("Missing sub claim in JWT payload")
            raise credentials_exception
            
        # Get email from user metadata if available
        email = payload.get("email")
        if not email:
            user_metadata = payload.get("user_metadata", {})
            email = user_metadata.get("email") or f"{sub}@example.com"
            
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise credentials_exception
    
    try:
        # Get user from Supabase profiles table
        supabase = get_supabase_client()
        response = supabase.from_("profiles").select("*").eq("id", str(sub)).single().execute()
        
        if not response.data:
            # Create user if they don't exist
            username = email.split('@')[0] if email else f"user_{sub[:8]}"
            new_user_data = {
                "id": sub,
                "email": email,
                "username": username,
                "status": "ONLINE",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            response = supabase.from_("profiles").insert(new_user_data).execute()
            if not response.data:
                logger.error("Failed to create user profile")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user profile"
                )
            user_data = response.data[0]
            logger.info(f"Created new user profile with ID {sub}")
        else:
            user_data = response.data
            
        # Convert to Pydantic model
        return User(**user_data)
        
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred"
        )

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a new access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt 