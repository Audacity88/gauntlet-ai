from fastapi import APIRouter, Depends, UploadFile, HTTPException, File
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import filetype
import logging
import io
import traceback

from app.core.database import get_db
from app.core.storage import storage
from app.models.message import Message, MessageAttachment
from app.models.direct_message import DirectMessage, DirectMessageAttachment
from app.schemas.message import MessageAttachment as MessageAttachmentSchema
from app.schemas.message import DirectMessageAttachment as DirectMessageAttachmentSchema
from app.schemas.message import MessageAttachmentCreate

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/upload/message/{message_id}", response_model=MessageAttachmentSchema)
async def upload_message_file(
    message_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a file and attach it to a channel message."""
    file_path = None
    try:
        logger.info(f"Starting file upload for message_id: {message_id}, filename: {file.filename}")
        
        # Read file content for type detection and upload
        content = await file.read()
        kind = filetype.guess(content)
        content_type = kind.mime if kind else file.content_type or 'application/octet-stream'
        file_size = len(content)
        
        logger.info(f"File details - Size: {file_size}, Type: {content_type}")
        
        # Create a new SpooledTemporaryFile with the content
        file_obj = io.BytesIO(content)
        
        # Create a new UploadFile with the content we already read
        memory_file = UploadFile(file=file_obj, filename=file.filename)
        memory_file._content_type = content_type
        
        # Generate unique file path
        file_path = f"messages/{message_id}/{file.filename}"
        logger.info(f"Generated file path: {file_path}")
        
        # Upload to Supabase Storage
        file_url = await storage.upload_file(memory_file, file_path)
        logger.info(f"File uploaded successfully to: {file_url}")
        
        # Create database record
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise ValueError(f"Message with ID {message_id} not found")
        
        db_attachment = MessageAttachment(
            message_id=message_id,
            filename=file.filename,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type
        )
        
        db.add(db_attachment)
        db.commit()
        db.refresh(db_attachment)
        logger.info("Database record created successfully")
        
        return db_attachment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        # If database operation fails, try to clean up the uploaded file
        if file_path:
            try:
                await storage.delete_file(file_path)
                logger.info("Cleaned up uploaded file after error")
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file: {str(cleanup_error)}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "File upload failed",
                "error": str(e),
                "type": "general_error"
            }
        )

@router.post("/upload/dm/{direct_message_id}", response_model=DirectMessageAttachmentSchema)
async def upload_dm_file(
    direct_message_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a file and attach it to a direct message."""
    file_path = None
    try:
        logger.info(f"Starting file upload for direct_message_id: {direct_message_id}, filename: {file.filename}")
        
        # Read file content for type detection and upload
        content = await file.read()
        kind = filetype.guess(content)
        content_type = kind.mime if kind else file.content_type or 'application/octet-stream'
        file_size = len(content)
        
        logger.info(f"File details - Size: {file_size}, Type: {content_type}")
        
        # Create a new SpooledTemporaryFile with the content
        file_obj = io.BytesIO(content)
        
        # Create a new UploadFile with the content we already read
        memory_file = UploadFile(file=file_obj, filename=file.filename)
        memory_file._content_type = content_type
        
        # Generate unique file path
        file_path = f"direct_messages/{direct_message_id}/{file.filename}"
        logger.info(f"Generated file path: {file_path}")
        
        # Upload to Supabase Storage
        file_url = await storage.upload_file(memory_file, file_path)
        logger.info(f"File uploaded successfully to: {file_url}")
        
        # Create database record
        direct_message = db.query(DirectMessage).filter(DirectMessage.id == direct_message_id).first()
        if not direct_message:
            raise ValueError(f"Direct message with ID {direct_message_id} not found")
        
        db_attachment = DirectMessageAttachment(
            direct_message_id=direct_message_id,
            filename=file.filename,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type
        )
        
        db.add(db_attachment)
        db.commit()
        db.refresh(db_attachment)
        logger.info("Database record created successfully")
        
        return db_attachment
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        # If database operation fails, try to clean up the uploaded file
        if file_path:
            try:
                await storage.delete_file(file_path)
                logger.info("Cleaned up uploaded file after error")
            except Exception as cleanup_error:
                logger.error(f"Failed to clean up file: {str(cleanup_error)}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "File upload failed",
                "error": str(e),
                "type": "general_error"
            }
        )

@router.delete("/message/{attachment_id}")
async def delete_message_file(attachment_id: UUID, db: Session = Depends(get_db)):
    """Delete a message file attachment."""
    try:
        attachment = db.query(MessageAttachment).filter(MessageAttachment.id == attachment_id).first()
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        # Delete from storage
        try:
            success = await storage.delete_file(attachment.file_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to delete file from storage")
        except Exception as e:
            logger.error(f"Storage deletion failed: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        
        # Delete database record
        db.delete(attachment)
        db.commit()
        logger.info(f"File attachment {attachment_id} deleted successfully")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"File deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/dm/{attachment_id}")
async def delete_dm_file(attachment_id: UUID, db: Session = Depends(get_db)):
    """Delete a direct message file attachment."""
    try:
        attachment = db.query(DirectMessageAttachment).filter(DirectMessageAttachment.id == attachment_id).first()
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        # Delete from storage
        try:
            success = await storage.delete_file(attachment.file_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to delete file from storage")
        except Exception as e:
            logger.error(f"Storage deletion failed: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        
        # Delete database record
        db.delete(attachment)
        db.commit()
        logger.info(f"File attachment {attachment_id} deleted successfully")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"File deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 