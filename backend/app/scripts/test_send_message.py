import asyncio
import httpx
import uuid
from typing import Dict, Any
import jwt
from datetime import datetime, timedelta
import json
import base64
from app.core.config import settings
import logging

# Test user IDs - using UUIDs that match your Supabase users
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
    exp = now + timedelta(days=30)
    
    # Token claims required by Supabase
    token_data = {
        "aud": "authenticated",
        "exp": int(exp.timestamp()),
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
        "amr": [{"method": "password", "timestamp": int(now.timestamp())}],
        "session_id": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "iss": "supabase"
    }
    
    # Get JWT secret
    jwt_secret = settings.SUPABASE_JWT_SECRET
    try:
        if isinstance(jwt_secret, str):
            # Add maximum padding and let b64decode handle truncation
            padded_secret = jwt_secret + "==="
            jwt_secret = base64.b64decode(padded_secret)
    except Exception as e:
        # If decoding fails, use the string as UTF-8 bytes
        if isinstance(jwt_secret, str):
            jwt_secret = jwt_secret.encode('utf-8')
        logger.warning(f"Failed to decode JWT secret as base64, using as UTF-8: {e}")
    
    # Generate token
    token = jwt.encode(token_data, jwt_secret, algorithm="HS256")
    return token

def verify_token(token: str) -> Dict[str, Any]:
    """Verify a JWT token using the same settings as the backend."""
    try:
        # Get JWT secret
        jwt_secret = settings.SUPABASE_JWT_SECRET
        try:
            if isinstance(jwt_secret, str):
                # Add maximum padding and let b64decode handle truncation
                padded_secret = jwt_secret + "==="
                jwt_secret = base64.b64decode(padded_secret)
        except Exception as e:
            # If decoding fails, use the string as UTF-8 bytes
            if isinstance(jwt_secret, str):
                jwt_secret = jwt_secret.encode('utf-8')
            logger.warning(f"Failed to decode JWT secret as base64, using as UTF-8: {e}")
        
        # Verify token with the same options as the backend
        return jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            issuer="supabase",
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_sub": True,
                "require": ["exp", "aud", "iss", "sub"]
            }
        )
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise

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
                "Hello! This is a test message from User 1."
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
                "Hi User 1! This is a response from User 2."
            )
            print("\nMessage sent successfully!")
            print(f"Response: {json.dumps(response, indent=2)}")
        except Exception as e:
            print(f"Error sending message from User 2: {e}")
    except Exception as e:
        print(f"Script error: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 