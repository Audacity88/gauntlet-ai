#!/usr/bin/env python3

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.append(str(backend_dir))

from app.scripts.import_test_messages import parse_messages

def main():
    test_file = Path(backend_dir) / "app/rag/data/test_messages.tsv"
    messages = parse_messages(test_file)
    
    print("\nParsed Messages:")
    print("-" * 50)
    for msg in messages:
        print(f"\nUsername: {msg['username']}")
        print(f"Timestamp: {msg['timestamp']}")
        print(f"Content: {msg['content']}")
        print("-" * 50)

if __name__ == "__main__":
    main() 