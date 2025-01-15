from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User
from app.models.file import (
    FileType,
    FileVisibility,
    FileMetadata,
    FileUploadResponse,
    FileUpdate,
    upload_file,
    get_file,
    update_file,
    delete_file
)
import filetype
from datetime import datetime

router = APIRouter()

@router.post("/upload", response_model=FileUploadResponse)
async def upload_new_file(
    file: UploadFile = File(...),
    file_type: FileType = Form(...),
    visibility: FileVisibility = Form(FileVisibility.PRIVATE),
    additional_metadata: str = Form("{}"),
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> FileUploadResponse:
    """
    Upload a new file to storage.
    """
    try:
        # Read file content
        file_content = await file.read()
        
        # Validate file type
        kind = filetype.guess(file_content)
        if not kind:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine file type"
            )
            
        # Create metadata
        metadata = FileMetadata(
            content_type=kind.mime,
            size=len(file_content),
            original_name=file.filename,
            file_type=file_type,
            visibility=visibility,
            additional_metadata=additional_metadata
        )
        
        # Upload file
        result = await upload_file(
            db,
            file.filename,
            file_content,
            metadata,
            current_user.id
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not upload file"
            )
            
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )

@router.get("/{file_id}", response_model=FileUploadResponse)
async def get_file_details(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> FileUploadResponse:
    """
    Get file details by ID.
    """
    file_data = await get_file(db, file_id, current_user.id)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or you don't have permission to access it"
        )
    return file_data

@router.patch("/{file_id}", response_model=FileUploadResponse)
async def update_file_metadata(
    file_id: str,
    update_data: FileUpdate,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> FileUploadResponse:
    """
    Update file metadata.
    Only the file owner can update it.
    """
    updated_file = await update_file(db, file_id, current_user.id, update_data)
    if not updated_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or you don't have permission to update it"
        )
    return updated_file

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> None:
    """
    Delete a file.
    Only the file owner can delete it.
    """
    success = await delete_file(db, file_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or you don't have permission to delete it"
        )

@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
):
    """
    Download a file by ID.
    """
    # Get file details
    file_data = await get_file(db, file_id, current_user.id)
    if not file_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or you don't have permission to access it"
        )
        
    try:
        # Get download URL from storage
        download_url = db.storage.from_("files").get_public_url(file_data.bucket_path)
        
        # Return URL for client to download directly
        return {"download_url": download_url}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating download URL: {str(e)}"
        ) 