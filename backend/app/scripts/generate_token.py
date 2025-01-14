#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

from datetime import datetime, timedelta
from uuid import uuid4
from app.api.deps import create_access_token
from app.core.config import settings

def generate_test_token():
    """Generate a test JWT token."""
    # Create test user data
    user_data = {
        "sub": "test@example.com",  # Subject (user email)
        "id": str(uuid4()),  # User ID
        "exp": datetime.utcnow() + timedelta(days=30)  # 30 day expiration
    }
    
    # Ensure we have the JWT secret
    if not settings.SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET is not set in environment variables")
    
    # Generate token using Supabase JWT secret
    token = create_access_token(user_data)
    
    print("\nTest JWT Token (valid for 30 days):")
    print("------------------------------------")
    print(token)
    print("\nSet this as your CHAT_TOKEN environment variable:")
    print("export CHAT_TOKEN='<token>'")

if __name__ == "__main__":
    generate_test_token() 