"""Security utilities for JWT token handling."""
import jwt
from typing import Dict, Any
from app.core.config import settings

def create_jwt_token(claims: Dict[str, Any]) -> str:
    """Create a JWT token with the given claims."""
    # Add issuer if not present
    if 'iss' not in claims:
        claims['iss'] = f"{settings.SUPABASE_URL}/auth/v1"
    
    # Get JWT secret - use as plain string
    jwt_secret = settings.SUPABASE_JWT_SECRET
    if isinstance(jwt_secret, str):
        jwt_secret = jwt_secret.encode('utf-8')
    
    # Generate token
    return jwt.encode(claims, jwt_secret, algorithm="HS256")

def verify_token(token: str) -> Dict[str, Any]:
    """Verify a JWT token using the same settings as the backend."""
    try:
        # Get JWT secret - use as plain string
        jwt_secret = settings.SUPABASE_JWT_SECRET
        if isinstance(jwt_secret, str):
            jwt_secret = jwt_secret.encode('utf-8')
        
        # Verify token with the same options as the backend
        return jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            issuer=f"{settings.SUPABASE_URL}/auth/v1",  # Match backend's expected issuer
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_sub": True,
                "require": ["exp", "aud", "iss", "sub"]
            }
        )
    except Exception as e:
        print(f"Token verification failed: {e}")
        raise 