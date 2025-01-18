#!/usr/bin/env python3

import asyncio
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
import httpx
import uuid
import pandas as pd
from typing import Optional, Dict, Any, List, Tuple
from supabase import create_client, Client
from postgrest.exceptions import APIError

# Make these imports optional since we don't need them for testing the parser
try:
    from app.core.database import Client, create_client
except ImportError:
    pass

load_dotenv()

def is_timestamp_line(line: str) -> bool:
    """Check if a line contains a timestamp in the format [HH:MM AM/PM]"""
    return bool(re.match(r'^\[\d{1,2}:\d{2} [AP]M\]$', line))

def is_number_line(line: str) -> bool:
    """Check if a line is just a number"""
    return bool(re.match(r'^\d+$', line))

def is_header_line(line: str) -> bool:
    """Check if line is a username-timestamp header line"""
    return ' — ' in line

def parse_messages(file_path: Path) -> List[Dict[str, Any]]:
    """Parse messages from the file"""
    messages = []
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines, @ references, URLs, and number-only lines
        if (not line or line.startswith('@') or line.startswith('http') 
            or is_number_line(line)):
            i += 1
            continue
            
        # If this is a header line, look ahead for consecutive headers
        if is_header_line(line):
            current_header = line
            peek = i + 1
            
            # Keep looking ahead while we find consecutive headers
            while peek < len(lines):
                next_line = lines[peek].strip()
                if is_header_line(next_line):
                    current_header = next_line  # Keep the latest header
                    peek += 1
                    i = peek  # Update i to skip all previous headers
                else:
                    break
                    
            # Now process the last header we found
            parts = current_header.split(' — ')
            if len(parts) != 2:
                i += 1
                continue
                
            username, timestamp = parts
            username = username.strip()
            timestamp = timestamp.strip()
            
            # Initialize content list to handle multi-line messages
            content_lines = []
            
            # Move to next line
            i += 1
            
            # Keep reading lines until we hit another timestamp line or end of file
            while i < len(lines):
                next_line = lines[i].strip()
                
                # Stop if we hit another message header or empty line
                if not next_line or is_header_line(next_line) or next_line.startswith('@'):
                    break
                    
                # Skip URLs, numbers, and timestamp-only lines
                if (not next_line.startswith('http') and 
                    not is_number_line(next_line) and 
                    not is_timestamp_line(next_line)):
                    content_lines.append(next_line)
                
                i += 1
                
            # Join content lines, defaulting to username if no content
            content = ' '.join(content_lines) if content_lines else username
                
            try:
                # Try different timestamp formats
                dt = None
                try:
                    # Try MM/DD/YY, HH:MM AM/PM format
                    dt = datetime.strptime(timestamp, '%m/%d/%y, %I:%M %p')
                except ValueError:
                    try:
                        # Try "Yesterday at HH:MM AM" format
                        if timestamp.startswith('Yesterday at '):
                            time_str = timestamp.replace('Yesterday at ', '')
                            time_part = datetime.strptime(time_str, '%I:%M %p').time()
                            dt = datetime.combine(datetime.now().date() - timedelta(days=1), time_part)
                        # Try "Today at HH:MM AM" format
                        elif timestamp.startswith('Today at '):
                            time_str = timestamp.replace('Today at ', '')
                            time_part = datetime.strptime(time_str, '%I:%M %p').time()
                            dt = datetime.combine(datetime.now().date(), time_part)
                    except ValueError:
                        print(f"Error parsing timestamp {timestamp}")
                        continue
                
                if dt:
                    messages.append({
                        'username': username,
                        'content': content,
                        'timestamp': dt.isoformat()
                    })
            except Exception as e:
                print(f"Error parsing timestamp {timestamp}: {e}")
                continue
        else:
            i += 1
    
    return messages

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    
async def create_user_and_profile(http_client: httpx.AsyncClient, username: str) -> str:
    email = f"{username.lower().replace(' ', '_')}@example.com"
    
    auth_headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    # First check if user exists
    response = await http_client.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=auth_headers
    )
    
    if response.status_code == 200:
        response_data = response.json()
        users = response_data.get('users', [])
        print(f"Found {len(users)} users")
        
        # Find user by email
        existing_user = next((user for user in users if user.get("email") == email), None)
        if existing_user:
            print(f"Found existing user with email {email}")
            user_id = existing_user["id"]
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user_data = {
                "id": user_id,
                "email": email,
                "password": "test123",  # Dummy password
                "email_confirm": True
            }
            
            response = await http_client.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=auth_headers,
                json=user_data
            )
            
            if response.status_code != 201:
                print(f"Error creating user: {response.text}")
                raise Exception(f"Failed to create user: {response.text}")
            print(f"Created new user with email {email}")
    else:
        print(f"Error checking for existing user: {response.text}")
        raise Exception(f"Failed to check for existing user: {response.text}")
        
    # Now check if profile exists
    response = await http_client.get(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers={**auth_headers, "Prefer": "return=representation"},
        params={"id": f"eq.{user_id}"}
    )
    
    if response.status_code == 200:
        profiles = response.json()
        if not profiles:
            # Create new profile
            profile_data = {
                "id": user_id,
                "username": username,
                "full_name": username,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            response = await http_client.post(
                f"{SUPABASE_URL}/rest/v1/profiles",
                headers={**auth_headers, "Prefer": "return=representation"},
                json=profile_data
            )
            
            if response.status_code != 201:
                print(f"Error creating profile: {response.text}")
                raise Exception(f"Failed to create profile: {response.text}")
            print(f"Created new profile for user {user_id}")
        else:
            print(f"Found existing profile for user {user_id}")
    else:
        print(f"Error checking for existing profile: {response.text}")
        raise Exception(f"Failed to check for existing profile: {response.text}")
        
    return user_id

async def get_or_create_user_and_profile(client: Client, username: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get or create a user and profile, handling race conditions."""
    try:
        # Try to find existing profile first
        try:
            print(f"Looking for existing profile for username: {username}")
            response = client.table('profiles').select("*").eq("username", username).execute()
            response_data = response.data if hasattr(response, 'data') else []
            # print(f"Profile search response: {response_data}")
            if response_data:
                existing_profile = response_data[0]
                print(f"Found existing profile")
                return {"id": existing_profile["id"]}, existing_profile
        except Exception as e:
            print(f"Error searching for profile: {str(e)}")
            if hasattr(e, 'response'):
                print(f"Response: {e.response}")
            pass
        
        # No profile found, create a new user and profile
        try:
            user_id = str(uuid4())
            email = f"{username.lower().replace(' ', '_')}@test.com"
            
            # Create auth user first
            async with httpx.AsyncClient() as http_client:
                headers = {
                    "apikey": os.getenv("SUPABASE_SERVICE_KEY"),
                    "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_KEY')}",
                    "Content-Type": "application/json"
                }
                user_data = {
                    "id": user_id,
                    "email": email,
                    "password": "test123",  # Temporary password
                    "email_confirm": True,
                    "user_metadata": {'username': username}
                }
                print(f"Creating new auth user with data: {user_data}")
                response = await http_client.post(
                    f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users",
                    headers=headers,
                    json=user_data
                )
                # print(f"Auth user creation response: {response.text}")
                if response.status_code == 201:
                    user_response = response.json()
                    user_id = user_response["id"]
                elif "duplicate key value" in response.text:
                    # If user already exists, try to fetch it
                    response = await http_client.get(
                        f"{os.getenv('SUPABASE_URL')}/auth/v1/admin/users",
                        headers=headers
                    )
                    if response.status_code == 200:
                        users = response.json()["users"]
                        existing_user = next((user for user in users if user["email"] == email), None)
                        if existing_user:
                            user_id = existing_user["id"]
                        else:
                            raise Exception(f"Could not find user with email {email}")
                    else:
                        raise Exception(f"Failed to fetch existing user: {response.text}")
                else:
                    raise Exception(f"Failed to create auth user")
            
            # Now create the profile
            profile_data = {
                "id": user_id,
                "username": username,
                "full_name": username
            }
            print(f"Creating new profile with data: {profile_data}")
            response = client.table('profiles').insert(profile_data).execute()
            response_data = response.data if hasattr(response, 'data') else []
            print(f"Profile creation response: {response_data}")
            if response_data:
                profile = response_data[0]
                return {"id": user_id}, profile
            else:
                # If profile creation failed, try to fetch existing profile
                try:
                    response = client.table('profiles').select("*").eq("id", user_id).execute()
                    response_data = response.data if hasattr(response, 'data') else []
                    if response_data:
                        existing_profile = response_data[0]
                        print(f"Found existing profile after creation failed: {existing_profile}")
                        return {"id": user_id}, existing_profile
                except Exception as inner_e:
                    print(f"Error fetching existing profile: {str(inner_e)}")
                raise Exception("Failed to create profile and couldn't find existing one")
        except Exception as e:
            print(f"Error creating user/profile: {str(e)}")
            if hasattr(e, 'response'):
                print(f"Response: {e.response}")
            raise
    except Exception as e:
        print(f"Unexpected error in get_or_create_user_and_profile: {str(e)}")
        if hasattr(e, 'response'):
            print(f"Response: {e.response}")
        raise

async def create_channel_from_file(client: Client, created_by_user_id: str, file_path: Path) -> Dict[str, Any]:
    """Create or get channel based on filename."""
    # Get channel name from filename (without extension)
    channel_name = file_path.stem
    
    # Check if channel exists
    try:
        response = client.table('channels').select("*").eq("slug", channel_name).execute()
        response_data = response.data if hasattr(response, 'data') else []
        if response_data:
            return response_data[0]
    except Exception as e:
        print(f"Error checking for existing channel: {str(e)}")
        if hasattr(e, 'response'):
            print(f"Response: {e.response}")
        pass

    # Create channel
    try:
        channel_data = {
            "id": str(uuid4()),
            "slug": channel_name,
            "created_by": created_by_user_id
        }
        response = client.table('channels').insert(channel_data).execute()
        response_data = response.data if hasattr(response, 'data') else []
        if response_data:
            return response_data[0]
        else:
            # If creation failed, try one last time to get existing channel
            response = client.table('channels').select("*").eq("slug", channel_name).execute()
            response_data = response.data if hasattr(response, 'data') else []
            if response_data:
                return response_data[0]
            raise Exception("Failed to create channel and couldn't find existing one")
    except Exception as e:
        print(f"Error creating channel: {str(e)}")
        if hasattr(e, 'response'):
            print(f"Response: {e.response}")
        raise

async def import_messages(messages: List[Dict[str, Any]], file_path: Path) -> None:
    print("\nImporting messages to database...")
    
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")
    
    client = create_client(supabase_url, supabase_key)
    print(f"Initializing Supabase client with URL: {supabase_url}")

    successful_imports = 0
    skipped_messages = 0

    try:
        # Try to find or create first user and channel
        first_message = messages[0]
        print(f"Processing first message: {first_message}")
        
        # Create new user/profile
        try:
            first_user, first_profile = await get_or_create_user_and_profile(
                client, first_message['username']
            )
        except Exception as e:
            print(f"Error creating first user/profile: {str(e)}")
            print(f"Error type: {type(e)}")
            if hasattr(e, 'response'):
                print(f"Response: {e.response}")
            return

        # Create or get channel based on filename
        channel = await create_channel_from_file(client, str(first_user["id"]), file_path)

        # Cache for user/profile pairs to avoid redundant database calls
        user_profile_cache = {
            first_message['username']: (first_user, first_profile)
        }

        # Process all messages
        for msg in messages:
            try:
                if msg['username'] not in user_profile_cache:
                    try:
                        user, profile = await get_or_create_user_and_profile(
                            client, msg['username']
                        )
                        user_profile_cache[msg['username']] = (user, profile)
                    except Exception as e:
                        print(f"Error creating user/profile for {msg['username']}: {str(e)}")
                        skipped_messages += 1
                        continue
                else:
                    user, profile = user_profile_cache[msg['username']]

                message_data = {
                    "id": str(uuid4()),
                    "channel_id": channel["id"],
                    "user_id": user["id"],
                    "profile_id": profile["id"],
                    "content": msg['content'],
                    "inserted_at": msg['timestamp']
                }
                response = client.table('messages').insert(message_data).execute()
                response_data = response.data if hasattr(response, 'data') else []
                if response_data:
                    successful_imports += 1
                else:
                    print(f"Error importing message: No data in response")
                    skipped_messages += 1
            except Exception as e:
                print(f"Error importing message: {str(e)}")
                skipped_messages += 1

        print(f"\nImport summary:")
        print(f"Successfully imported: {successful_imports} messages")
        print(f"Skipped messages: {skipped_messages}")
        print("Import completed!")

    except Exception as e:
        print(f"Error during import: {str(e)}")
        raise e

async def main() -> None:
    """Main function to run the import script"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import messages from a TSV file into Supabase')
    parser.add_argument('file_path', type=str, help='Path to the TSV file containing messages')
    args = parser.parse_args()
    
    # Convert the input path to a Path object
    file_path = Path(args.file_path)
    
    if not file_path.exists():
        raise FileNotFoundError(f"Message file not found at {file_path}")
        
    # Parse messages from the file
    messages = parse_messages(file_path)
    print(f"Parsed {len(messages)} messages from {file_path}")
    
    # Import the messages
    await import_messages(messages, file_path)

if __name__ == "__main__":
    asyncio.run(main())