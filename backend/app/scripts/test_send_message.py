import asyncio
import httpx
import uuid
from typing import Dict, Any
import jwt
from datetime import datetime, timedelta
from app.core.config import settings

# Test user IDs
USER1_ID = "71f56be5-4c32-40f1-99c5-e2458ab9c34e"
USER2_ID = "a70786c5-ad26-4906-b041-c5b9868f950e"

# API configuration
API_URL = "http://localhost:8000"
HEADERS = {
    "Content-Type": "application/json",
    # We'll add the auth token dynamically
}

def generate_token(user_id: str) -> str:
    """Generate a JWT token for testing"""
    user_data = {
        "sub": user_id,
        "email": f"user_{user_id}@test.com",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int((datetime.utcnow() + timedelta(days=30)).timestamp())
    }
    
    return jwt.encode(
        user_data,
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256"
    )

async def send_message(token: str, target_user_id: str, content: str) -> Dict[str, Any]:
    """Send a message to a user"""
    headers = {**HEADERS, "Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{API_URL}/api/chat/send",
                headers=headers,
                json={
                    "target_user_id": target_user_id,
                    "content": content,
                    "mode": "direct"
                }
            )
            print(f"Response status: {response.status_code}")
            print(f"Response body: {response.text}")
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

async def main():
    try:
        # Generate tokens for both users
        print("Generating auth tokens...")
        user1_token = generate_token(USER1_ID)
        user2_token = generate_token(USER2_ID)
        
        print("\nTesting message from User 1 to User 2...")
        try:
            response = await send_message(
                user1_token,
                USER2_ID,
                "Hello! This is a test message from User 1."
            )
            print("Message sent successfully!")
            print(f"Response: {response}")
        except Exception as e:
            print(f"Error sending message from User 1: {e}")
        
        print("\nTesting message from User 2 to User 1...")
        try:
            response = await send_message(
                user2_token,
                USER1_ID,
                "Hi User 1! This is a response from User 2."
            )
            print("Message sent successfully!")
            print(f"Response: {response}")
        except Exception as e:
            print(f"Error sending message from User 2: {e}")
    except Exception as e:
        print(f"Script error: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 