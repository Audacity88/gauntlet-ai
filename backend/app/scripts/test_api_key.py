from dotenv import load_dotenv, find_dotenv
import os
from pathlib import Path

print("Current environment OPENAI_API_KEY:", os.getenv('OPENAI_API_KEY'))

# Get the absolute path to the backend directory (2 levels up from this script)
backend_dir = Path(__file__).resolve().parents[2]
env_path = backend_dir / '.env'

print(f"\nLooking for .env file at: {env_path}")
print(f"File exists: {env_path.exists()}")

if env_path.exists():
    print("\nContents of .env file:")
    with open(env_path, 'r') as f:
        for line in f:
            if line.startswith('OPENAI_API_KEY'):
                key = line.strip().split('=')[1]
                print(f"Found OPENAI_API_KEY in .env: {key[:8]}...")

print("\nTrying to load environment variables...")
# Load environment variables from the correct path
load_dotenv(dotenv_path=env_path, override=True)

# Get and print the API key
api_key = os.getenv('OPENAI_API_KEY')
print("\nAfter loading .env file:")
if api_key:
    print(f"API Key found: {api_key[:8]}...")  # Only print first 8 chars for security
else:
    print("No API key found in environment variables")