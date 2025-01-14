#!/usr/bin/env python3
import os
import sys
from pathlib import Path
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

async def create_test_users():
    """Create test users in Supabase."""
    test_users = [
        {
            "email": "test.user@gmail.com",
            "password": "test_password_123",
            "data": {
                "username": "test_user",
                "full_name": "Test User"
            }
        },
        {
            "email": "casual.user@gmail.com",
            "password": "test_password_123",
            "data": {
                "username": "casual_user",
                "full_name": "Casual User"
            }
        },
        {
            "email": "formal.user@gmail.com",
            "password": "test_password_123",
            "data": {
                "username": "formal_user",
                "full_name": "Formal User"
            }
        }
    ]
    
    print("Creating test users...")
    for user_data in test_users:
        try:
            # Create user in Supabase Auth
            user = supabase.auth.sign_up({
                "email": user_data["email"],
                "password": user_data["password"],
                "options": {
                    "data": user_data["data"]
                }
            })
            print(f"Created user: {user_data['email']} (ID: {user.user.id})")
        except Exception as e:
            if "User already registered" in str(e):
                print(f"User already exists: {user_data['email']}")
            else:
                print(f"Error creating user {user_data['email']}: {str(e)}")
    
    print("\nTest users created successfully!")

if __name__ == "__main__":
    asyncio.run(create_test_users()) 