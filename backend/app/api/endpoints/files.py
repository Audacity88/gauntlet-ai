from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Upload a file."""
    try:
        # Read file content
        content = await file.read()
        
        # TODO: Process file content
        # For now, just return success
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading file: {str(e)}"
        ) 