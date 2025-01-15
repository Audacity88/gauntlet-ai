from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User, UserUpdate, get_user_by_id, update_user

router = APIRouter()

@router.get("/me", response_model=User)
async def read_current_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get the current authenticated user's profile.
    """
    return current_user

@router.patch("/me", response_model=User)
async def update_current_user(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> User:
    """
    Update the current user's profile information.
    """
    updated_user = await update_user(db, current_user.id, update_data)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update user profile"
        )
    return updated_user

@router.get("/{user_id}", response_model=User)
async def read_user(
    user_id: str,
    db: Client = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get a specific user's profile by ID.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.get("/", response_model=List[User])
async def list_users(
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    db: Client = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[User]:
    """
    List users with optional search and pagination.
    """
    try:
        query = db.from_("auth.users").select("*")
        
        # Add search filter if provided
        if search:
            query = query.or_(f"email.ilike.%{search}%,username.ilike.%{search}%")
            
        # Add pagination
        query = query.range(skip, skip + limit - 1)
        
        response = await query.execute()
        return [User(**user) for user in response.data]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing users: {str(e)}"
        ) 