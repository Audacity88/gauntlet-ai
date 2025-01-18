from enum import Enum

class MessageType(str, Enum):
    TEXT = "text"
    SYSTEM = "system"
    THREAD = "thread"
    REPLY = "reply"
    FILE = "file"

class ChatMode(str, Enum):
    DIRECT = "direct"
    CHANNEL = "channel"
    SYSTEM = "system"

class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system" 