from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.database import get_db, Client
from app.core.auth import get_current_user
from app.models.user import User
from app.models.message import (
    Message,
    MessageCreate,
    MessageUpdate,
    create_message,
    get_message,
    update_message,
    delete_message,
    get_channel_messages
)

router = APIRouter()

@router.post("/", response_model=Message)
async def create_new_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> Message:
    """
    Create a new message.
    """
    message = await create_message(db, current_user.id, message_data)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not create message"
        )
    return message

@router.get("/{message_id}", response_model=Message)
async def read_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> Message:
    """
    Get a specific message by ID.
    """
    message = await get_message(db, message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    return message

@router.patch("/{message_id}", response_model=Message)
async def update_existing_message(
    message_id: str,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> Message:
    """
    Update a message.
    Only the message owner can update it.
    """
    message = await update_message(db, message_id, current_user.id, update_data)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you don't have permission to update it"
        )
    return message

@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> None:
    """
    Delete a message.
    Only the message owner can delete it.
    """
    success = await delete_message(db, message_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or you don't have permission to delete it"
        )

@router.get("/channel/{channel_id}", response_model=List[Message])
async def list_channel_messages(
    channel_id: str,
    before: Optional[str] = Query(None, description="Get messages before this message ID"),
    limit: int = Query(50, ge=1, le=100, description="Number of messages to return"),
    current_user: User = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> List[Message]:
    """
    Get messages from a channel with pagination.
    Messages are returned in reverse chronological order (newest first).
    """
    messages = await get_channel_messages(db, channel_id, limit, before)
    return messages 