from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import uvicorn
from typing import Dict, Optional
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
import logging
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
import base64
import json

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detailed logs
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Settings configuration
class Settings(BaseSettings):
    """Application settings."""
    
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        case_sensitive=True,
        extra='allow'  # Allow extra fields
    )
    
    SUPABASE_JWT_SECRET: str

settings = Settings()

# Create FastAPI app
app = FastAPI(title="Test Chat API")

# CORS configuration
origins = [
    "http://localhost:3000",     # Local development
    "http://localhost:5173",     # Vite default
    "https://chatgenius-nu.vercel.app",  # Vercel production
    "https://chatgenius-git-main-dangilles.vercel.app",  # Vercel preview
    "https://chatgenius-dangilles.vercel.app",  # Vercel custom domain
]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# JWT Configuration
def get_jwt_secret():
    """Get JWT secret and decode if base64 encoded"""
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        logger.error("SUPABASE_JWT_SECRET is not set")
        return None
        
    try:
        # Try to decode as base64
        decoded = base64.b64decode(secret)
        logger.info("Successfully decoded base64 JWT secret")
        return decoded
    except Exception as e:
        logger.warning(f"JWT secret is not base64 encoded, using as is: {str(e)}")
        if isinstance(secret, str):
            return secret.encode('utf-8')
        return secret

JWT_SECRET = get_jwt_secret()
logger.info(f"Using JWT secret (first 5 chars of raw): {str(JWT_SECRET)[:5]}...")

# In-memory storage
class UserStore:
    def __init__(self):
        self.users: Dict[str, Dict] = {}
        self.messages: Dict[str, list] = {}
    
    def get_user(self, user_id: str) -> Optional[Dict]:
        return self.users.get(user_id)
    
    def create_user(self, user_id: str, email: str) -> Dict:
        user = {
            "id": user_id,
            "email": email,
            "username": email.split('@')[0] if email else f"user_{user_id[:8]}",
            "status": "ONLINE",
            "created_at": str(datetime.now(timezone.utc)),
            "updated_at": str(datetime.now(timezone.utc))
        }
        self.users[user_id] = user
        self.messages[user_id] = []
        return user
    
    def add_message(self, user_id: str, content: str) -> Dict:
        if user_id not in self.messages:
            self.messages[user_id] = []
        
        message = {
            "id": f"msg_{len(self.messages[user_id])}",
            "content": content,
            "user_id": user_id,
            "created_at": str(datetime.now(timezone.utc))
        }
        self.messages[user_id].append(message)
        return message
    
    def get_messages(self, user_id: str, limit: int = 10) -> list:
        return self.messages.get(user_id, [])[-limit:]

# Create global store
store = UserStore()

# Security
security = HTTPBearer()

class MessageRequest(BaseModel):
    content: str
    target_user_id: Optional[str] = None

class UserSummaryRequest(BaseModel):
    target_user_id: str

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    try:
        token = credentials.credentials
        logger.debug(f"Received token: {token[:10]}...")
        
        if not JWT_SECRET:
            logger.error("SUPABASE_JWT_SECRET is not set")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Server configuration error: JWT secret not set",
            )
        
        # Log token parts for debugging
        try:
            parts = token.split('.')
            if len(parts) == 3:
                header, payload, signature = parts
                logger.debug(f"Token structure - Header: {header[:10]}... Payload: {payload[:10]}... Signature: {signature[:10]}...")
                # Decode payload without verification for debugging
                padded_payload = payload + '=' * (-len(payload) % 4)
                decoded_payload = base64.b64decode(padded_payload)
                payload_data = json.loads(decoded_payload)
                logger.debug(f"Raw payload data: {payload_data}")
            else:
                logger.warning("Token does not have three parts")
        except Exception as e:
            logger.warning(f"Could not decode token parts: {str(e)}")
        
        try:
            # First try to decode without verification for debugging
            unverified = jwt.decode(token, options={"verify_signature": False})
            logger.debug(f"Unverified token payload: {unverified}")
            
            # Log the expected signature
            try:
                import hmac
                import hashlib
                message = f"{parts[0]}.{parts[1]}"
                expected_sig = base64.urlsafe_b64encode(
                    hmac.new(
                        JWT_SECRET if isinstance(JWT_SECRET, bytes) else JWT_SECRET.encode(),
                        message.encode(),
                        hashlib.sha256
                    ).digest()
                ).rstrip(b'=').decode('utf-8')
                logger.debug(f"Expected signature prefix: {expected_sig[:10]}")
                logger.debug(f"Received signature prefix: {signature[:10]}")
            except Exception as e:
                logger.warning(f"Could not calculate expected signature: {str(e)}")
            
            # Now try actual verification
            decoded = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            logger.debug("Successfully verified token signature")
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user_id = decoded.get("sub")
        if not user_id:
            logger.warning("Token missing user ID")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get or create user from token data
        email = decoded.get("email", "")
        user = store.get_user(user_id)
        if not user:
            user = store.create_user(user_id, email)
            logger.info(f"Created new user: {user['username']} ({user_id})")
        
        logger.debug(f"Retrieved/created user: {user['username']}")
        return user
            
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Token validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/api/chat/send")
async def send_message(
    request: MessageRequest,
    current_user: Dict = Depends(verify_token)
) -> Dict:
    logger.info(f"Received message from user {current_user['username']}")
    message = store.add_message(current_user['id'], request.content)
    return {
        "status": "success",
        "message": "Message sent successfully",
        "data": {
            "content": message['content'],
            "sender": current_user["username"],
            "timestamp": message['created_at']
        }
    }

@app.post("/api/chat/user_summary")
async def get_user_summary(
    request: UserSummaryRequest,
    current_user: Dict = Depends(verify_token)
) -> Dict:
    target_user = store.get_user(request.target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    recent_messages = store.get_messages(request.target_user_id)
    return {
        "status": "success",
        "data": {
            "user": target_user,
            "recent_messages": recent_messages
        }
    }

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    print("\n=== Test Configuration ===")
    print(f"JWT Secret being used (first 5 chars): {str(JWT_SECRET)[:5]}...")
    
    print("\n=== CORS Configuration ===")
    print("Allowed Origins:")
    for origin in origins:
        print(f"  - {origin}")
    print("\nAllowed Methods: *")
    print("Allowed Headers: *")
    print("Allow Credentials: True")
    print("Max Age: 3600")
    
    print("\n=== API Endpoints ===")
    print("1. POST /api/chat/send")
    print("2. POST /api/chat/user_summary")
    print("3. GET /api/health")
    
    print("\n=== Testing Instructions ===")
    print("1. Use your Supabase token in the Authorization header:")
    print('   Authorization: Bearer <your-supabase-token>')
    print("\n2. Test CORS with curl:")
    print('   # Test preflight (OPTIONS):')
    print('   curl -X OPTIONS http://localhost:8000/api/chat/send \\')
    print('     -H "Origin: http://localhost:3000" \\')
    print('     -H "Access-Control-Request-Method: POST" \\')
    print('     -H "Access-Control-Request-Headers: authorization,content-type" \\')
    print('     -v')
    print('\n   # Test actual request:')
    print('   curl -X POST http://localhost:8000/api/chat/send \\')
    print('     -H "Origin: http://localhost:3000" \\')
    print('     -H "Authorization: Bearer <your-token>" \\')
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{"content": "Hello, world!"}\' \\')
    print('     -v')
    
    # Run the server
    uvicorn.run(app, host="0.0.0.0", port=8000) 