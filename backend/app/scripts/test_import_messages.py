#!/usr/bin/env python3

from datetime import datetime
from pathlib import Path
import re

def is_timestamp_line(line: str) -> bool:
    """Check if a line contains a timestamp in the format [HH:MM AM/PM]"""
    return bool(re.match(r'^\[\d{1,2}:\d{2} [AP]M\]$', line))

def is_number_line(line: str) -> bool:
    """Check if a line is just a number"""
    return bool(re.match(r'^\d+$', line))

def is_header_line(line: str) -> bool:
    """Check if line is a username-timestamp header line"""
    return ' — ' in line

def parse_messages(file_path: Path) -> list[dict]:
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
                dt = datetime.strptime(timestamp, '%m/%d/%y, %I:%M %p')
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

def main():
    test_file = Path(__file__).parent.parent / "rag/data/test_messages.tsv"
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