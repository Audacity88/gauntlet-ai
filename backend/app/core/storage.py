from typing import Optional
from fastapi import UploadFile
import httpx
import logging
import json

from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            logger.error("Supabase configuration missing")
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
            
        self.base_url = f"{settings.SUPABASE_URL}/storage/v1"
        self.headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_KEY
        }
        self.bucket_id = settings.SUPABASE_STORAGE_BUCKET
        logger.info(f"StorageService initialized with URL: {self.base_url}, bucket: {self.bucket_id}")
        logger.debug(f"Using service key: {settings.SUPABASE_SERVICE_KEY[:10]}...")
        
    async def initialize_bucket(self) -> None:
        """Ensure the storage bucket exists, create if it doesn't."""
        async with httpx.AsyncClient() as client:
            try:
                logger.info(f"Checking if bucket {self.bucket_id} exists")
                # Check if bucket exists
                response = await client.get(
                    f"{self.base_url}/bucket/{self.bucket_id}",
                    headers=self.headers
                )
                
                logger.info(f"Bucket check response: {response.status_code}")
                logger.debug(f"Response content: {response.text}")
                
                if response.status_code == 404:
                    logger.info(f"Creating bucket {self.bucket_id}")
                    # Create bucket if it doesn't exist
                    create_response = await client.post(
                        f"{self.base_url}/bucket",
                        headers=self.headers,
                        json={
                            "id": self.bucket_id,
                            "name": self.bucket_id,
                            "public": True,
                            "file_size_limit": settings.MAX_UPLOAD_SIZE,
                            "allowed_mime_types": ["image/*", "application/pdf", "text/*"]
                        }
                    )
                    if create_response.status_code != 200 and create_response.status_code != 201:
                        error_msg = f"Failed to create bucket: {create_response.text}"
                        logger.error(error_msg)
                        try:
                            error_json = create_response.json()
                            logger.error(f"Error details: {json.dumps(error_json, indent=2)}")
                        except:
                            pass
                        raise Exception(error_msg)
                    logger.info("Bucket created successfully")
                    
                    # Set up RLS policy for the bucket
                    policy_response = await client.post(
                        f"{self.base_url}/bucket/{self.bucket_id}/policy",
                        headers=self.headers,
                        json={
                            "name": "authenticated_access",
                            "definition": {
                                "role": "authenticated",
                                "resource": f"storage.objects.{self.bucket_id}.*",
                                "action": "ALL"
                            }
                        }
                    )
                    if policy_response.status_code != 200 and policy_response.status_code != 201:
                        logger.error(f"Failed to set bucket policy: {policy_response.text}")
                        
            except Exception as e:
                logger.error(f"Error initializing bucket: {str(e)}")
                raise

    async def upload_file(self, file: UploadFile, path: Optional[str] = None) -> str:
        """Upload a file to Supabase Storage and return its URL."""
        if not path:
            path = file.filename
            
        try:
            # Ensure bucket exists
            await self.initialize_bucket()
            
            # Read file content
            content = await file.read()
            file_size = len(content)
            
            if file_size > settings.MAX_UPLOAD_SIZE:
                raise ValueError(f"File size exceeds maximum limit of {settings.MAX_UPLOAD_SIZE} bytes")
            
            logger.info(f"Uploading file {path} ({file_size} bytes)")
            logger.debug(f"Upload URL: {self.base_url}/object/{self.bucket_id}/{path}")
            logger.debug(f"Headers: {json.dumps({k: '***' if k in ['Authorization', 'apikey'] else v for k, v in self.headers.items()})}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/object/{self.bucket_id}/{path}",
                    headers=self.headers,
                    content=content,
                    timeout=30.0  # Increase timeout for larger files
                )
                
                logger.info(f"Upload response status: {response.status_code}")
                logger.debug(f"Response headers: {dict(response.headers)}")
                
                if response.status_code != 200:
                    error_msg = f"Failed to upload file: {response.text}"
                    logger.error(error_msg)
                    try:
                        error_json = response.json()
                        logger.error(f"Error details: {json.dumps(error_json, indent=2)}")
                    except:
                        pass
                    raise Exception(error_msg)
                
                file_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{self.bucket_id}/{path}"
                logger.info(f"File uploaded successfully: {file_url}")
                return file_url
                
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise
            
    async def delete_file(self, path: str) -> bool:
        """Delete a file from Supabase Storage."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    f"{self.base_url}/object/{self.bucket_id}/{path}",
                    headers=self.headers
                )
                success = response.status_code == 200
                if not success:
                    logger.error(f"Failed to delete file {path}: {response.text}")
                    try:
                        error_json = response.json()
                        logger.error(f"Error details: {json.dumps(error_json, indent=2)}")
                    except:
                        pass
                return success
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            raise

# Create a singleton instance
storage = StorageService() 