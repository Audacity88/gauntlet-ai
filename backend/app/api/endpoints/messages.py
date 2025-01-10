from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.message import Message
from app.models.direct_message import DirectMessage
from app.models.channel import Channel
from app.models.user import User, Profile
from app.schemas.message import (
    Message as MessageSchema,
    MessageCreate,
    DirectMessage as DirectMessageSchema,
    DirectMessageCreate
)

router = APIRouter()

@router.post("/channel/{channel_id}", response_model=MessageSchema)
async def create_channel_message(
    channel_id: UUID,
    message: MessageCreate,
    db: Session = Depends(get_db)
):
    """Create a new channel message."""
    try:
        # Verify channel exists
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Verify user exists
        user = db.query(User).filter(User.id == message.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify profile exists
        profile = db.query(Profile).filter(Profile.id == message.profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Create message
        db_message = Message(
            channel_id=channel_id,
            user_id=message.user_id,
            profile_id=message.profile_id,
            content=message.content
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dm", response_model=DirectMessageSchema)
async def create_direct_message(
    message: DirectMessageCreate,
    db: Session = Depends(get_db)
):
    """Create a new direct message."""
    try:
        # Verify sender exists
        sender = db.query(User).filter(User.id == message.sender_id).first()
        if not sender:
            raise HTTPException(status_code=404, detail="Sender not found")

        # Verify recipient exists
        recipient = db.query(User).filter(User.id == message.recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")

        # Verify profile exists
        profile = db.query(Profile).filter(Profile.id == message.profile_id).first()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Create direct message
        db_message = DirectMessage(
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            profile_id=message.profile_id,
            content=message.content
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        return db_message
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/channel/{channel_id}", response_model=List[MessageSchema])
async def get_channel_messages(
    channel_id: UUID,
    limit: int = 50,
    before_id: UUID = None,
    db: Session = Depends(get_db)
):
    """Get messages from a channel with pagination."""
    try:
        # Verify channel exists
        channel = db.query(Channel).filter(Channel.id == channel_id).first()
        if not channel:
            raise HTTPException(status_code=404, detail="Channel not found")

        # Build query
        query = db.query(Message).filter(Message.channel_id == channel_id)
        
        # Add pagination
        if before_id:
            before_message = db.query(Message).filter(Message.id == before_id).first()
            if before_message:
                query = query.filter(Message.inserted_at < before_message.inserted_at)
        
        messages = query.order_by(Message.inserted_at.desc()).limit(limit).all()
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dm/{user_id}", response_model=List[DirectMessageSchema])
async def get_direct_messages(
    user_id: UUID,
    other_user_id: UUID,
    limit: int = 50,
    before_id: UUID = None,
    db: Session = Depends(get_db)
):
    """Get direct messages between two users with pagination."""
    try:
        # Verify both users exist
        user = db.query(User).filter(User.id == user_id).first()
        other_user = db.query(User).filter(User.id == other_user_id).first()
        if not user or not other_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Build query for messages between the two users
        query = db.query(DirectMessage).filter(
            ((DirectMessage.sender_id == user_id) & (DirectMessage.recipient_id == other_user_id)) |
            ((DirectMessage.sender_id == other_user_id) & (DirectMessage.recipient_id == user_id))
        )
        
        # Add pagination
        if before_id:
            before_message = db.query(DirectMessage).filter(DirectMessage.id == before_id).first()
            if before_message:
                query = query.filter(DirectMessage.inserted_at < before_message.inserted_at)
        
        messages = query.order_by(DirectMessage.inserted_at.desc()).limit(limit).all()
        return messages
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/channel/{message_id}")
async def delete_channel_message(
    message_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a channel message."""
    try:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        db.delete(message)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/dm/{message_id}")
async def delete_direct_message(
    message_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a direct message."""
    try:
        message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        
        db.delete(message)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 