#!/usr/bin/env python3
import os
import sys
from pathlib import Path
import psycopg2
from urllib.parse import urlparse

# Add the backend directory to the Python path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)

from app.core.config import settings

def get_db_url(url):
    """Convert a regular PostgreSQL URL to a psycopg2 URL."""
    if not url:
        return None
    
    # Parse the URL
    parsed = urlparse(url)
    
    # Extract project ID from hostname
    project_id = parsed.hostname.split('.')[1]
    
    # Get password from environment variable
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        raise ValueError("SUPABASE_DB_PASSWORD environment variable is not set")
    
    # Return connection parameters with session pooler settings
    return {
        "host": "aws-0-us-west-1.pooler.supabase.com",
        "port": 5432,  # Session pooler port
        "database": "postgres",
        "user": f"postgres.{project_id}",
        "password": password,
        "sslmode": "require"
    }

def check_users():
    """Check users in the database."""
    # Use SUPABASE_DB_URL if available, otherwise fall back to DATABASE_URL
    db_url = settings.SUPABASE_DB_URL or settings.DATABASE_URL
    db_params = get_db_url(db_url)
    print(f"Using database parameters: {db_params}")
    
    try:
        # Create connection
        conn = psycopg2.connect(**db_params)
        print("\nDatabase connection successful!")
        
        # Create cursor
        cur = conn.cursor()
        
        try:
            # List all schemas
            cur.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT IN ('information_schema', 'pg_catalog');
            """)
            schemas = cur.fetchall()
            print("\nAvailable schemas:", [schema[0] for schema in schemas])
            
            # Check auth.users table
            print("\nQuerying auth.users table...")
            cur.execute("""
                SELECT id, email, raw_user_meta_data 
                FROM auth.users;
            """)
            users = cur.fetchall()
            
            print("\nUsers in auth.users table:")
            for user in users:
                print(f"ID: {user[0]}")
                print(f"Email: {user[1]}")
                print(f"Metadata: {user[2]}")
                print("-" * 50)
            
            # Check public.profiles table
            print("\nQuerying public.profiles table...")
            cur.execute("""
                SELECT id, username, full_name 
                FROM public.profiles;
            """)
            profiles = cur.fetchall()
            
            print("\nProfiles in public.profiles table:")
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

if __name__ == "__main__":
    check_users() 