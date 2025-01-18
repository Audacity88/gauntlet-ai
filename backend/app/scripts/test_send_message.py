#!/usr/bin/env python
import os
import sys
from pathlib import Path
from urllib.parse import urlparse
import base64
import json
import asyncio
import httpx
from datetime import datetime, timezone
from typing import Dict, Any
from uuid import UUID

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.security import create_jwt_token, verify_token
from app.core.database import get_supabase_client

# Test users
USER1_ID = "71f56be5-4c32-40f1-99c5-e2458ab9c34e"
USER2_ID = "a70786c5-ad26-4906-b041-c5b9868f950e"

# API configuration
API_URL = "http://localhost:8000"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def generate_token(user_id: str) -> str:
    """Generate a JWT token for testing."""
    now = datetime.utcnow()
    claims = {
        "aud": "authenticated",
        "exp": int((now.replace(year=now.year + 1) - datetime(1970, 1, 1)).total_seconds()),
        "sub": user_id,
        "email": f"test_{user_id}@example.com",
        "phone": "",
        "app_metadata": {
            "provider": "email",
            "providers": ["email"]
        },
        "user_metadata": {},
        "role": "authenticated",
        "aal": "aal1",
        "amr": [{
            "method": "password",
            "timestamp": int((now - datetime(1970, 1, 1)).total_seconds())
        }],
        "session_id": "ef3d51e3-03cf-45ef-a40d-9159cc0e93ee"
    }
    return create_jwt_token(claims)

async def send_message(token: str, target_user_id: str, content: str) -> Dict[str, Any]:
    """Send a message to a user"""
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient() as client:
            # First try a preflight OPTIONS request
            options_response = await client.options(
                f"{API_URL}/api/chat/send",
                headers=headers
            )
            print(f"OPTIONS response status: {options_response.status_code}")
            print(f"OPTIONS response headers: {dict(options_response.headers)}")
            
            # Now send the actual request
            response = await client.post(
                f"{API_URL}/api/chat/send",
                headers=headers,
                json={
                    "target_user_id": target_user_id,
                    "content": content,
                    "mode": "direct"
                },
                timeout=30.0  # Increase timeout for debugging
            )
            
            print(f"\nRequest details:")
            print(f"URL: {response.request.url}")
            print(f"Method: {response.request.method}")
            print(f"Headers: {response.request.headers}")
            print(f"Body: {response.request.content.decode()}")
            
            print(f"\nResponse details:")
            print(f"Status: {response.status_code}")
            print(f"Headers: {dict(response.headers)}")
            print(f"Body: {response.text}")
            
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        print(f"HTTP error occurred: {e}")
        print(f"Error response: {e.response.text}")
        raise
    except httpx.RequestError as e:
        print(f"Request error occurred: {e}")
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise

async def check_messages(token: str) -> None:
    """Check messages in Supabase"""
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Query direct_messages table
        response = supabase.table('direct_messages').select('*').execute()
        
        print("\nMessages in Supabase:")
        if hasattr(response, 'data'):
            for msg in response.data:
                print(f"\nMessage ID: {msg.get('id')}")
                print(f"Channel ID: {msg.get('channel_id')}")
                print(f"User ID: {msg.get('user_id')}")
                print(f"Profile ID: {msg.get('profile_id')}")
                print(f"Content: {msg.get('content')}")
                print(f"Message Type: {msg.get('message_type')}")
                print(f"Metadata: {json.dumps(msg.get('metadata'), indent=2)}")
                print(f"Created At: {msg.get('created_at')}")
        else:
            print("No messages found or error accessing messages")
            
    except Exception as e:
        print(f"Error checking messages: {e}")

async def main():
    """Main test function."""
    try:
        # Generate tokens for both users
        print("\nGenerating auth tokens...")
        user1_token = generate_token(USER1_ID)
        user2_token = generate_token(USER2_ID)
        
        print("\nToken debug info:")
        print(f"User 1 token: {user1_token[:50]}...")
        
        # Try to decode tokens without verification for debugging
        parts = user1_token.split('.')
        if len(parts) == 3:
            header = base64.b64decode(parts[0] + '=' * (-len(parts[0]) % 4))
            payload = base64.b64decode(parts[1] + '=' * (-len(parts[1]) % 4))
            print(f"Token header: {header}")
            print(f"Raw payload: {payload}")
            print(f"Decoded payload: {json.loads(payload)}")
        
        # Verify tokens
        verified_payload = verify_token(user1_token)
        print(f"\nVerified token payload: {json.dumps(verified_payload, indent=2)}")
        
        print("\nTesting message from User 1 to User 2...")
        try:
            response = await send_message(
                user1_token,
                USER2_ID,
                "Hello! This is a new test message from User 1."
            )
            print("\nMessage sent successfully!")
            print(f"Response: {json.dumps(response, indent=2)}")
        except Exception as e:
            print(f"Error sending message from User 1: {e}")
        
        print("\nTesting message from User 2 to User 1...")
        try:
            response = await send_message(
                user2_token,
                USER1_ID,
                "Hi User 1! This is a new response from User 2."
            )
            print("\nMessage sent successfully!")
            print(f"Response: {json.dumps(response, indent=2)}")
        except Exception as e:
            print(f"Error sending message from User 2: {e}")
            
        print("\nChecking messages in Supabase...")
        await check_messages(user1_token)
        
    except Exception as e:
        print(f"Script error: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 