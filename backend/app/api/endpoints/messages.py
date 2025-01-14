from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/")
async def get_messages(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Get messages for the current user."""
    try:
        # TODO: Implement message retrieval
        return {
            "messages": []
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving messages: {str(e)}"
        ) 