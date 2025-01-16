#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

from datetime import datetime, timedelta
from uuid import uuid4
import jwt
from app.core.config import settings

def generate_test_token():
    """Generate a test JWT token."""
    # Create test user data
    user_data = {
        "sub": "98250a74-c387-404a-a834-9ae7f5eaab17",  # User ID from testing notes
        "email": "testuser@gmail.com",  # Email from testing notes
        "aud": "authenticated",
        "role": "authenticated",
        "exp": int((datetime.utcnow() + timedelta(days=30)).timestamp())  # 30 day expiration
    }
    
    # Ensure we have the JWT secret
    if not settings.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET is not set in environment variables")
    
    # Generate token using Supabase JWT secret
    token = jwt.encode(
        user_data,
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256"
    )
    
    print("\nTest JWT Token (valid for 30 days):")
    print("------------------------------------")
    print(token)
    print("\nUse this token in your curl command:")
    print('curl -X POST "http://localhost:8001/api/chat/send" \\')
    print('  -H "Authorization: Bearer ' + token + '" \\')
    print('  -H "Content-Type: application/json" \\')
    print('  -d \'{')
    print('    "content": "Hello, this is a test message",')
    print('    "target_user_id": "98250a74-c387-404a-a834-9ae7f5eaab17",')
    print('    "message_type": "text",')
    print('    "mode": "direct"')
    print('  }\'')

if __name__ == "__main__":
    generate_test_token() 