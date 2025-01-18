from datetime import datetime, timezone
from typing import Optional, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
import jwt
import logging
import base64
import json

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserStatus

logger = logging.getLogger(__name__)
security = HTTPBearer()

def get_jwt_secret():
    """Get JWT secret and decode if base64 encoded"""
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        logger.error("SUPABASE_JWT_SECRET is not set")
        return None
        
    try:
        # Add maximum padding and let b64decode handle truncation
        padded_secret = secret + "==="
        decoded = base64.b64decode(padded_secret)
        logger.info("Successfully decoded base64 JWT secret")
        return decoded
    except Exception as e:
        logger.warning(f"JWT secret is not base64 encoded, using as is: {str(e)}")
        if isinstance(secret, str):
            return secret.encode('utf-8')
        return secret

# Get the decoded JWT secret once at startup
JWT_SECRET = get_jwt_secret()
if JWT_SECRET:
    logger.info(f"JWT secret loaded successfully (first 5 bytes): {JWT_SECRET[:5]}")
else:
    logger.error("Failed to load JWT secret")

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Client, Depends(get_db)]
) -> User:
    """
    Get the current authenticated user from profiles table.
    """
    try:
        # Decode token to get user ID
        token = credentials.credentials
        logger.debug(f"Attempting to decode token: {token[:10]}...")
        
        if not JWT_SECRET:
            logger.error("SUPABASE_JWT_SECRET is not set")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: JWT secret not set",
            )
            
        try:
            # Log token parts for debugging
            parts = token.split('.')
            if len(parts) == 3:
                header, payload, signature = parts
                logger.debug(f"Token structure - Header: {header[:10]}... Payload: {payload[:10]}... Signature: {signature[:10]}...")
                
                # Decode payload without verification for debugging
                # Add maximum padding and let b64decode handle truncation
                decoded_payload = base64.b64decode(payload + "===")
                payload_data = json.loads(decoded_payload)
                logger.debug(f"Raw payload data: {payload_data}")
            
            decoded = jwt.decode(
                token, 
                JWT_SECRET, 
                algorithms=["HS256"],
                audience="authenticated",
                issuer="supabase",
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "verify_sub": True,
                    "require": ["exp", "aud", "iss", "sub"]
                }
            )
            logger.info(f"Successfully decoded token for user: {decoded.get('sub', 'unknown')}")
            logger.debug(f"Decoded token data: {json.dumps(decoded, indent=2)}")
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as e:
            logger.error(f"Error decoding token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = decoded.get("sub")
        if not user_id:
            logger.error("Token missing user ID")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        logger.info(f"Checking profiles for user_id: {user_id}")
        
        try:
            # Get user data from profiles table - execute synchronously
            response = db.from_("profiles").select("*").eq("id", user_id).single().execute()
            logger.debug(f"Profile query response: {response}")
            
            if not response.data:
                # Profile doesn't exist, create it
                email = decoded.get("email", "")
                username = email.split("@")[0]
                
                profile_data = {
                    "id": user_id,
                    "username": username,
                    "full_name": decoded.get("user_metadata", {}).get("full_name", ""),
                    "status": UserStatus.ONLINE.value,  # Use the enum value
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                
                logger.info(f"Creating new profile for user {user_id}")
                try:
                    # Execute synchronously
                    insert_response = db.from_("profiles").insert(profile_data).execute()
                    logger.debug(f"Profile creation response: {insert_response}")
                    
                    if not insert_response.data:
                        logger.error(f"Failed to create profile for user {user_id}")
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                            detail="Failed to create user profile"
                        )
                        
                    user_data = insert_response.data[0]
                except Exception as e:
                    logger.error(f"Error creating profile: {str(e)}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                        detail=f"Error creating user profile: {str(e)}"
                    )
            else:
                user_data = response.data[0]
                
            # Convert status to enum before creating User object
            if isinstance(user_data["status"], str):
                user_data["status"] = UserStatus(user_data["status"])
                
            # Convert datetime strings to datetime objects
            if isinstance(user_data["created_at"], str):
                user_data["created_at"] = datetime.fromisoformat(user_data["created_at"].replace("Z", "+00:00"))
            if isinstance(user_data["updated_at"], str):
                user_data["updated_at"] = datetime.fromisoformat(user_data["updated_at"].replace("Z", "+00:00"))
            if user_data.get("last_seen") and isinstance(user_data["last_seen"], str):
                user_data["last_seen"] = datetime.fromisoformat(user_data["last_seen"].replace("Z", "+00:00"))
                
            return User(**user_data)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error querying profile: {str(e)}")
            logger.exception(e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}")
        logger.exception(e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Client, Depends(get_db)]
) -> Optional[User]:
    """
    Get the current user if authenticated, otherwise return None.
    Useful for endpoints that can work with both authenticated and anonymous users.
    """
    if not credentials:
        return None
        
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None 