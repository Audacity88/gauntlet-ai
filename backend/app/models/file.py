from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, UUID4, Field, HttpUrl
from enum import Enum

class FileType(str, Enum):
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    OTHER = "other"

class FileVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    SHARED = "shared"

class FileMetadata(BaseModel):
    content_type: str
    size: int
    original_name: str
    file_type: FileType
    visibility: FileVisibility = FileVisibility.PRIVATE
    additional_metadata: Optional[Dict[str, Any]] = None

class FileUploadResponse(BaseModel):
    id: UUID4
    bucket_path: str
    url: HttpUrl
    metadata: FileMetadata
    uploaded_by: UUID4
    uploaded_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

class FileUpdate(BaseModel):
    visibility: Optional[FileVisibility] = None
    additional_metadata: Optional[Dict[str, Any]] = None

async def upload_file(
    supabase_client,
    file_path: str,
    file_data: bytes,
    metadata: FileMetadata,
    user_id: UUID4
) -> Optional[FileUploadResponse]:
    """Upload a file to Supabase storage"""
    try:
        # Upload file to storage
        bucket_path = f"uploads/{user_id}/{metadata.file_type}/{file_path}"
        response = await supabase_client.storage.from_("files").upload(
            bucket_path,
            file_data,
            {"content-type": metadata.content_type}
        )
        
        if not response.data:
            return None
            
        # Get file URL
        url_response = supabase_client.storage.from_("files").get_public_url(bucket_path)
        
        # Create file record in database
        file_data = {
            "bucket_path": bucket_path,
            "url": url_response,
            "metadata": metadata.dict(),
            "uploaded_by": str(user_id),
            "uploaded_at": datetime.utcnow()
        }
        
        db_response = await supabase_client.from_("files").insert(file_data).select("*").single()
        if not db_response.data:
            # Cleanup storage if database insert fails
            await supabase_client.storage.from_("files").remove([bucket_path])
            return None
            
        return FileUploadResponse(**db_response.data)
        
    except Exception as e:
        print(f"Error uploading file: {e}")
        return None

async def get_file(
    supabase_client,
    file_id: UUID4,
    user_id: UUID4
) -> Optional[FileUploadResponse]:
    """Get file details by ID"""
    try:
        response = await supabase_client.from_("files")\
            .select("*")\
            .eq("id", str(file_id))\
            .is_("deleted_at", None)\
            .single()
            
        if not response.data:
            return None
            
        file_data = response.data
        
        # Check visibility permissions
        if file_data["metadata"]["visibility"] == FileVisibility.PRIVATE:
            if str(user_id) != file_data["uploaded_by"]:
                return None
                
        return FileUploadResponse(**file_data)
        
    except Exception as e:
        print(f"Error getting file: {e}")
        return None

async def update_file(
    supabase_client,
    file_id: UUID4,
    user_id: UUID4,
    update_data: FileUpdate
) -> Optional[FileUploadResponse]:
    """Update file metadata"""
    try:
        # Get current file data
        current_file = await get_file(supabase_client, file_id, user_id)
        if not current_file or str(user_id) != str(current_file.uploaded_by):
            return None
            
        # Update metadata
        new_metadata = current_file.metadata.dict()
        if update_data.visibility:
            new_metadata["visibility"] = update_data.visibility
        if update_data.additional_metadata:
            new_metadata["additional_metadata"] = update_data.additional_metadata
            
        # Update database record
        response = await supabase_client.from_("files")\
            .update({"metadata": new_metadata, "updated_at": datetime.utcnow()})\
            .eq("id", str(file_id))\
            .eq("uploaded_by", str(user_id))\
            .select("*").single()
            
        return FileUploadResponse(**response.data) if response.data else None
        
    except Exception as e:
        print(f"Error updating file: {e}")
        return None

async def delete_file(
    supabase_client,
    file_id: UUID4,
    user_id: UUID4
) -> bool:
    """Soft delete a file"""
    try:
        # Get current file data
        current_file = await get_file(supabase_client, file_id, user_id)
        if not current_file or str(user_id) != str(current_file.uploaded_by):
            return False
            
        # Soft delete in database
        response = await supabase_client.from_("files")\
            .update({"deleted_at": datetime.utcnow()})\
            .eq("id", str(file_id))\
            .eq("uploaded_by", str(user_id))\
            .is_("deleted_at", None)\
            .select("id").single()
            
        return bool(response.data)
        
    except Exception as e:
        print(f"Error deleting file: {e}")
        return False 