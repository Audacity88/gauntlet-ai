#!/usr/bin/env python3

import asyncio
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select

from app.models.channel import Channel, ChannelMember
from app.models.message import Message, MessageAttachment
from app.models.user import User, Profile
from app.models.direct_message import DirectMessage, DirectMessageChannel, DirectMessageMember

load_dotenv()

def parse_timestamp(timestamp_str: str) -> datetime | None:
    try:
        # Try to parse "Yesterday at 1:25 AM" format
        if "Yesterday at" in timestamp_str:
            time_str = timestamp_str.replace("Yesterday at ", "")
            time_obj = datetime.strptime(time_str, "%I:%M %p")
            yesterday = datetime.now() - timedelta(days=1)
            return datetime.combine(yesterday.date(), time_obj.time())

        # Try to parse "Today at 1:15 AM" format
        if "Today at" in timestamp_str:
            time_str = timestamp_str.replace("Today at ", "")
            time_obj = datetime.strptime(time_str, "%I:%M %p")
            return datetime.combine(datetime.now().date(), time_obj.time())

        # Try to parse "1/5/25, 6:41 AM" format
        return datetime.strptime(timestamp_str, "%m/%d/%y, %I:%M %p")
    except ValueError:
        print(f"Failed to parse timestamp: {timestamp_str}")
        return None

def parse_messages(content: str) -> list[dict]:
    messages = []
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    i = 0
    while i < len(lines) - 1:  # Need at least 2 lines for a valid message
        # Check if current line matches the format "username — timestamp"
        match = re.match(r'^([^—]+) — (.+)$', lines[i])
        if match:
            username, timestamp = match.groups()
            timestamp_obj = parse_timestamp(timestamp.strip())
            
            # Only process if we have a valid timestamp and next line exists
            if timestamp_obj:
                messages.append({
                    'username': username.strip(),
                    'timestamp': timestamp_obj,
                    'content': lines[i + 1]
                })
                i += 2  # Skip the next line since we've used it as content
            else:
                i += 1  # Invalid timestamp, move to next line
        else:
            i += 1  # Not a username/timestamp line, move to next line
    
    return messages

async def get_or_create_user_and_profile(session: AsyncSession, username: str) -> tuple[User, Profile]:
    """Get or create a user and profile, handling race conditions."""
    
    # Build the user email from the username
    email = f"{username.lower()}@test.com"
    
    # Try to find existing profile first
    stmt = select(Profile).where(Profile.username == username)
    result = await session.execute(stmt)
    existing_profile = result.scalar_one_or_none()
    
    if existing_profile:
        # Get the associated user
        stmt = select(User).where(User.id == existing_profile.id)
        result = await session.execute(stmt)
        existing_user = result.scalar_one_or_none()
        if existing_user:
            return existing_user, existing_profile
    
    # No profile found, try to find user by email
    stmt = select(User).where(User.email == email)
    result = await session.execute(stmt)
    existing_user = result.scalar_one_or_none()
    
    if not existing_user:
        # Create new user with a new UUID and set username in metadata
        user_id = uuid4()
        existing_user = User(
            id=user_id,
            email=email,
            raw_user_meta_data={'username': username}  # This will be used by the trigger
        )
        session.add(existing_user)
        await session.flush()
    
    # Check one more time for an existing profile
    stmt = select(Profile).where(Profile.id == existing_user.id)
    result = await session.execute(stmt)
    existing_profile = result.scalar_one_or_none()
    
    if existing_profile:
        return existing_user, existing_profile
    
    # Create new profile with the user's ID
    try:
        profile = Profile(
            id=existing_user.id,
            username=username,  # The trigger will handle this based on raw_user_meta_data
            full_name=username
        )
        session.add(profile)
        await session.flush()
        return existing_user, profile
    except Exception as e:
        # If profile creation failed, try one last time to get existing profile
        stmt = select(Profile).where(Profile.id == existing_user.id)
        result = await session.execute(stmt)
        existing_profile = result.scalar_one_or_none()
        if existing_profile:
            return existing_user, existing_profile
        raise e

async def create_channel_from_file(session: AsyncSession, created_by_user_id: str, file_path: Path) -> Channel:
    """Create or get channel based on filename."""
    # Get channel name from filename (without extension)
    channel_name = file_path.stem
    
    # Check if channel exists
    stmt = select(Channel).where(Channel.slug == channel_name)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        # Create channel
        channel = Channel(
            id=uuid4(),
            slug=channel_name,
            created_by=created_by_user_id
        )
        session.add(channel)
        await session.flush()

    return channel

async def import_messages(messages: list[dict], file_path: Path):
    print("\nImporting messages to database...")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(database_url)
    async_session = sessionmaker(engine, class_=AsyncSession)

    successful_imports = 0
    skipped_messages = 0

    async with async_session() as session:
        async with session.begin():
            try:
                # Try to find or create first user and channel
                first_message = messages[0]
                
                # First try to find existing profile
                stmt = select(Profile).where(Profile.username == first_message['username'])
                result = await session.execute(stmt)
                first_profile = result.scalar_one_or_none()
                
                if first_profile:
                    # Get associated user
                    stmt = select(User).where(User.id == first_profile.id)
                    result = await session.execute(stmt)
                    first_user = result.scalar_one_or_none()
                    if not first_user:
                        print("Error: Found profile but no associated user")
                        return
                else:
                    # Create new user/profile
                    try:
                        first_user, first_profile = await get_or_create_user_and_profile(
                            session, first_message['username']
                        )
                    except Exception as e:
                        print(f"Error creating first user/profile: {str(e)}")
                        return

                # Create or get channel based on filename
                channel = await create_channel_from_file(session, str(first_user.id), file_path)

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
                                    session, msg['username']
                                )
                                user_profile_cache[msg['username']] = (user, profile)
                            except Exception as e:
                                print(f"Error creating user/profile for {msg['username']}: {str(e)}")
                                skipped_messages += 1
                                continue
                        else:
                            user, profile = user_profile_cache[msg['username']]

                        message = Message(
                            id=uuid4(),
                            channel_id=channel.id,
                            user_id=user.id,
                            profile_id=profile.id,
                            content=msg['content'],
                            inserted_at=(
                                msg['timestamp'] if msg['timestamp'] else datetime.now()
                            )
                        )
                        session.add(message)
                        successful_imports += 1
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

async def main():
    import argparse
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Import messages from a TSV file into the database.')
    parser.add_argument('file_path', nargs='?', type=str, 
                       default=str(Path(__file__).parent.parent.parent / "app/rag/data/test_messages.tsv"),
                       help='Path to the TSV file containing messages (default: test_messages.tsv)')
    
    args = parser.parse_args()
    file_path = Path(args.file_path)
    
    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        return
    
    if not file_path.suffix.lower() == '.tsv':
        print(f"Error: File must be a TSV file: {file_path}")
        return
    
    print(f"Reading messages from: {file_path}")

    with open(file_path, 'r') as f:
        content = f.read()

    messages = parse_messages(content)
    print(f"\nFound {len(messages)} messages to parse\n")

    await import_messages(messages, file_path)
    print("\nImport complete!")

if __name__ == "__main__":
    asyncio.run(main())
