from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import get_db, engine
from app.core.config import settings
from app.models.base import Base
from app.models.user import User, Profile  # Import User and Profile models first
from app.models.channel import Channel, ChannelMember  # Import Channel models
from app.models.direct_message import (  # Import DirectMessage models
    DirectMessageChannel,
    DirectMessageMember,
    DirectMessage
)
from app.models.message import Message, MessageAttachment  # Then dependent models
from app.api.api import api_router  # Import the API router

# Create FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Mount API routes
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Welcome to the Slack Clone API"} 