#!/usr/bin/env python
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

import asyncio
import httpx
import json
import psycopg2
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from app.core.database import get_session, async_session
from app.models.user import User
from app.models.message import Message
from app.core.config import settings

# Configuration
BASE_URL = "http://localhost:8000/api/chat"  # Updated to match FastAPI router
TOKEN = os.getenv("CHAT_TOKEN")  # JWT token for authentication

HELP_TEXT = """
Available commands:
/help           - Show this help message
/quit           - Exit the chat
/stream         - Toggle streaming mode
/target <name>  - Set the target user to imitate (using username)
/dm             - Toggle DM mode
/context        - Show the current chat state
/clear          - Clear the message context
/users          - List available users
"""

class ChatState:
    """Maintains the state of the chat session."""
    def __init__(self):
        self.streaming = False
        self.message_id = None
        self.target_user_id = None
        self.is_dm = False
        self.show_metadata = True
        self.db_session = None

def get_db_url(url):
    """Convert a regular PostgreSQL URL to a psycopg2 URL."""
    if not url:
        return None
    
    # Get password from environment variable
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        raise ValueError("SUPABASE_DB_PASSWORD environment variable is not set")
    
    # Use direct connection string format with pooler
    return f"postgresql://postgres.gkwdjhgfeqzpypucnnnx:{password}@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require"

async def get_users(session: AsyncSession) -> list[User]:
    """Get list of users from database."""
    result = await session.execute(select(User))
    return result.scalars().all()

async def get_user_messages(session: AsyncSession, user_id: UUID, limit: int = 50) -> list[Message]:
    """Get recent messages for a user."""
    result = await session.execute(
        select(Message)
        .filter(Message.user_id == user_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()

async def send_message(
    content: str,
    target_user_id: str,
    message_id: Optional[str] = None,
    is_dm: bool = False,
    stream: bool = False,
    session: Optional[AsyncSession] = None
) -> Dict[str, Any]:
    """Send a message to the API and store in database."""
    if not TOKEN:
        raise Exception("CHAT_TOKEN environment variable not set")
    
    headers = {
        "Authorization": f"Bearer {TOKEN.strip()}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    data = {
        "content": content,
        "target_user_id": target_user_id,
        "message_id": message_id,
        "is_dm": is_dm
    }
    
    # Set endpoint before using it
    endpoint = "stream" if stream else "send"
    
    print(f"\nSending request to: {BASE_URL}/{endpoint}")
    print(f"Request data: {json.dumps(data, indent=2)}")
    
    # Send to API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BASE_URL}/{endpoint}",
                headers=headers,
                json=data,
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get('detail', error_detail)
                except:
                    pass
                raise Exception(f"Error: HTTP {response.status_code} - {error_detail}")
            
            # Store message in database if we have a session
            if session and not stream:
                response_data = response.json()
                new_message = Message(
                    user_id=UUID(target_user_id),
                    content=response_data["content"],
                    message_metadata={"model": response_data.get("model"), "usage": response_data.get("usage")}
                )
                session.add(new_message)
                await session.commit()
            
            return response
        except Exception as e:
            print(f"\nError sending message: {str(e)}")
            raise

async def process_stream(response: httpx.Response) -> None:
    """Process a streaming response."""
    async for line in response.aiter_lines():
        if line.startswith("data: "):
            try:
                data = json.loads(line[6:])
                if "content" in data:
                    print(data["content"], end="", flush=True)
                elif "error" in data:
                    print(f"\nError: {data['error']}")
            except json.JSONDecodeError:
                print(f"\nError decoding response: {line}")
    print("\n")

async def list_users(state: ChatState) -> None:
    """List all available users."""
    try:
        # Get database URL
        db_url = get_db_url(settings.DATABASE_URL)
        print(f"\nConnecting to database...")
        
        # Create connection
        conn = psycopg2.connect(db_url)
        print("Database connection successful!")
        
        # Create cursor
        cur = conn.cursor()
        
        try:
            # Check public.profiles table
            print("\nQuerying public.profiles table...")
            cur.execute("""
                SELECT id, username, full_name 
                FROM public.profiles;
            """)
            profiles = cur.fetchall()
            
            if not profiles:
                print("\nNo users found in the database.")
            else:
                print("\nAvailable users:")
                for profile in profiles:
                    print(f"ID: {profile[0]}")
                    print(f"Username: {profile[1]}")
                    print(f"Full Name: {profile[2]}")
                    print("-" * 50)
            
        except Exception as e:
            print(f"\nError executing queries: {str(e)}")
            raise
        finally:
            cur.close()
            
    except Exception as e:
        print(f"\nError connecting to database: {str(e)}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

def get_user_by_username(conn, username: str) -> Optional[str]:
    """Get user ID by username."""
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id 
            FROM public.profiles 
            WHERE LOWER(username) = LOWER(%s);
        """, (username,))
        result = cur.fetchone()
        return result[0] if result else None
    finally:
        cur.close()

def process_command(state: ChatState, command: str) -> bool:
    """Process a chat command. Returns True if should continue chat."""
    cmd_parts = command.split()
    cmd = cmd_parts[0].lower()
    
    if cmd == "/help":
        print(HELP_TEXT)
    elif cmd == "/quit":
        print("\nGoodbye!")
        return False
    elif cmd == "/stream":
        state.streaming = not state.streaming
        print(f"\nStreaming mode: {'enabled' if state.streaming else 'disabled'}")
    elif cmd == "/target":
        if len(cmd_parts) != 2:
            print("Usage: /target <username>")
            return True
        
        username = cmd_parts[1]
        
        try:
            # Get database URL
            db_url = get_db_url(settings.DATABASE_URL)
            print(f"\nConnecting to database...")
            
            # Create connection using connection string
            conn = psycopg2.connect(db_url)
            print("Database connection successful!")
            
            try:
                # Look up user ID by username
                user_id = get_user_by_username(conn, username)
                if user_id:
                    state.target_user_id = str(user_id)
                    state.message_id = None  # Reset message context
                    print(f"\nNow targeting user: {username} (ID: {user_id})")
                else:
                    print(f"\nNo user found with username: {username}")
            finally:
                conn.close()
                
        except Exception as e:
            print(f"\nError looking up user: {str(e)}")
            
    elif cmd == "/dm":
        state.is_dm = not state.is_dm
        print(f"\nDM mode: {'enabled' if state.is_dm else 'disabled'}")
    elif cmd == "/context":
        context_info = f"""
Current chat state:
- Target user: {state.target_user_id or 'Not set'}
- Message context: {state.message_id or 'None'}
- DM mode: {'enabled' if state.is_dm else 'disabled'}
- Streaming: {'enabled' if state.streaming else 'disabled'}
"""
        print(context_info)
    elif cmd == "/clear":
        state.message_id = None
        print("\nMessage context cleared")
    elif cmd == "/users":
        # Create event loop and run list_users
        loop = asyncio.get_event_loop()
        loop.run_until_complete(list_users(state))
    else:
        print(f"Unknown command: {cmd}")
        print("Type /help for available commands")
    
    return True

async def chat_loop() -> None:
    """Main chat loop."""
    print("Welcome to the AI Avatar Chat!")
    print("Type /help for available commands")
    
    state = ChatState()
    
    # Initialize database session
    try:
        session = async_session()
        state.db_session = session
        print("\nConnected to database successfully")
        print("Type /users to see available users")
    except Exception as e:
        print(f"\nWarning: Could not connect to database: {e}")
        print("Continuing without database connection...")
    
    try:
        while True:
            try:
                print("\nYou: ", end="", flush=True)
                user_input = input().strip()
                
                if not user_input:
                    continue
                
                # Handle commands
                if user_input.startswith("/"):
                    if user_input.lower() == "/users":
                        await list_users(state)
                        continue
                    elif not process_command(state, user_input):
                        break
                    continue
                
                # Ensure target user is set
                if not state.target_user_id:
                    print("\nPlease set a target user first with /target <username>")
                    continue
                
                response = await send_message(
                    content=user_input,
                    target_user_id=state.target_user_id,
                    message_id=state.message_id,
                    is_dm=state.is_dm,
                    stream=state.streaming,
                    session=state.db_session
                )
                
                if state.streaming:
                    await process_stream(response)
                else:
                    try:
                        data = response.json()
                        print(f"\nAvatar: {data['content']}")
                        if state.show_metadata:
                            print(f"\nModel: {data.get('model', 'unknown')}")
                            if "usage" in data:
                                total_tokens = data["usage"].get("total_tokens", 0)
                                print(f"Tokens used: {total_tokens}")
                        
                        # Update message context for continuity
                        if "message_id" in data:
                            state.message_id = data["message_id"]
                    except Exception as e:
                        print(f"\nError processing response: {str(e)}")
            
            except Exception as e:
                print(f"\nError: {str(e)}")
                if "quit" in str(e).lower():
                    break
    finally:
        # Clean up database session
        if state.db_session:
            await state.db_session.close()

def main():
    """Main entry point."""
    if not TOKEN:
        print("Error: CHAT_TOKEN environment variable not set")
        print("Please set it to your JWT authentication token")
        return
    
    try:
        asyncio.run(chat_loop())
    except KeyboardInterrupt:
        print("\nGoodbye!")

if __name__ == "__main__":
    main() 