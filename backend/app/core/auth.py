from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
import jwt

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserStatus

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Client = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from profiles table.
    """
    try:
        # Decode token to get user ID
        token = credentials.credentials
        try:
            decoded = jwt.decode(
                token, 
                settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": False}  # Skip audience verification
            )
            print(f"Successfully decoded token: {decoded}")
        except Exception as e:
            print(f"Error decoding token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = decoded.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        print(f"Checking profiles for user_id: {user_id}")
        
        try:
            # Get user data from profiles table
            response = db.from_("profiles").select("*").eq("id", user_id).execute()
            print(f"Profile query response: {response}")
            
            if not response.data:
                # Profile doesn't exist, create it
                email = decoded.get("email", "")
                username = email.split("@")[0]
                
                profile_data = {
                    "id": user_id,
                    "username": username,
                    "full_name": decoded.get("user_metadata", {}).get("full_name", ""),
                    "status": UserStatus.ONLINE.value,  # Use the enum value
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
                
                try:
                    insert_response = db.from_("profiles").insert(profile_data).execute()
                    print(f"Profile creation response: {insert_response}")
                    
                    if not insert_response.data:
                        raise HTTPException(status_code=500, detail="Failed to create user profile")
                        
                    user_data = insert_response.data[0]
                except Exception as e:
                    print(f"Error creating profile: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"Error creating user profile: {str(e)}")
            else:
                user_data = response.data[0]
                
            # Convert status to enum before creating User object
            if isinstance(user_data["status"], str):
                user_data["status"] = UserStatus(user_data["status"])
                
            return User(**user_data)
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error querying profile: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}",
            )
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_current_user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Client = Depends(get_db)
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