from fastapi import APIRouter, Depends, HTTPException, status
from app.api.deps import get_current_user, get_authenticated_user, get_admin_user, get_any_user
from app.models.user import User

router = APIRouter()

@router.get("/me")
async def read_current_user(current_user: User = Depends(get_current_user)):
    """Test endpoint to get current user information."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "metadata": current_user.raw_user_meta_data
    }

@router.get("/test-auth")
async def test_auth(current_user: User = Depends(get_authenticated_user)):
    """Test endpoint for authenticated users."""
    return {
        "message": "You are authenticated!",
        "user_id": str(current_user.id),
        "role": current_user.role
    }

@router.get("/test-admin")
async def test_admin(current_user: User = Depends(get_admin_user)):
    """Test endpoint for admin users."""
    return {
        "message": "You are an admin!",
        "user_id": str(current_user.id),
        "role": current_user.role
    }

@router.get("/test-public")
async def test_public(current_user: User = Depends(get_any_user)):
    """Test endpoint for any user (including anonymous)."""
    return {
        "message": f"Hello, {current_user.role} user!",
        "user_id": str(current_user.id)
    } 