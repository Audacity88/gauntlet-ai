from typing import Annotated, AsyncGenerator, Callable
from functools import wraps
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from gotrue.errors import AuthApiError, AuthUnknownError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import logging
import jwt
import uuid

from app.core.config import settings
from app.core.database import get_session
from app.models.user import User

logger = logging.getLogger(__name__)

# Supabase client configuration
# --------------------------------------------------------------------------------
try:
    supabase: Client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,
        options=ClientOptions(
            persist_session=False,
            auto_refresh_token=True,
        )
    )
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {str(e)}")
    raise

security = HTTPBearer()

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    session: AsyncSession = Depends(get_session)
) -> User:
    """Get the current user from the Supabase token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # First try to decode and verify the token
        try:
            # Log the token and secret being used (first 10 chars only for security)
            logger.debug(f"Attempting to validate token starting with: {credentials.credentials[:10]}...")
            logger.debug(f"Using JWT secret starting with: {settings.SUPABASE_JWT_SECRET[:10]}...")

            # First try to decode without verification to see the claims
            unverified_claims = jwt.decode(
                credentials.credentials,
                options={"verify_signature": False}
            )
            logger.debug(f"Unverified token claims: {unverified_claims}")

            # Now decode and verify the token using the JWT secret
            token_data = jwt.decode(
                credentials.credentials,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_signature": True}
            )
            logger.debug(f"Successfully verified token. Claims: {token_data}")
            
            # Check if it's an anonymous token
            if token_data.get("role") == "anon":
                logger.debug("Anonymous token detected")
                user_id = str(uuid.uuid4())
                email = f"anon-{user_id}@example.com"
                metadata = {"role": "anon"}

                # Create anonymous user in database
                db_user = User(
                    id=user_id,
                    email=email,
                    raw_user_meta_data=metadata
                )
                session.add(db_user)
                await session.commit()
                logger.info(f"Created anonymous user with ID {user_id}")
                return db_user

            # For authenticated users, get the user ID from the token
            user_id = token_data.get("sub")
            if not user_id:
                logger.error("No user ID (sub) in token claims")
                raise credentials_exception

            logger.debug(f"Found user_id in token: {user_id}")
            # Get or create user in our database
            try:
                stmt = select(User).where(User.id == user_id)
                result = await session.execute(stmt)
                db_user = result.scalar_one_or_none()

                if db_user is None:
                    # Create new user if not exists
                    logger.info(f"Creating new user with ID {user_id}")
                    db_user = User(
                        id=user_id,
                        email=token_data.get("email", ""),
                        raw_user_meta_data=token_data.get("user_metadata", {})
                    )
                    session.add(db_user)
                    await session.commit()
                    logger.info(f"Created new user with ID {user_id}")
                else:
                    # Update existing user if metadata changed
                    new_metadata = token_data.get("user_metadata", {})
                    if db_user.raw_user_meta_data != new_metadata:
                        logger.info(f"Updating user {user_id} metadata")
                        db_user.raw_user_meta_data = new_metadata
                        await session.commit()

                return db_user

            except Exception as e:
                logger.error(f"Database error while managing user: {str(e)}")
                await session.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error while managing user data"
                )

        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token format: {str(e)}")
            raise credentials_exception

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during authentication"
        )

# Role-based access control
# --------------------------------------------------------------------------------
def check_roles(allowed_roles: list[str]) -> Callable:
    """Create a dependency that checks if the user has one of the allowed roles."""
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            logger.warning(f"User {user.id} with role {user.role} attempted to access endpoint requiring roles: {allowed_roles}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have the required role to perform this action"
            )
        return user
    return role_checker

# Common role checks
get_admin_user = check_roles(["admin", "service_role"])
get_authenticated_user = check_roles(["authenticated", "admin", "service_role"])
get_any_user = check_roles(["anon", "authenticated", "admin", "service_role"])
