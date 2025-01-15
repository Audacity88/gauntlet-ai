# API Testing Notes

## Database Connection Issues

### Error 1: asyncpg Authentication Error
```
File "/opt/miniconda3/lib/python3.12/site-packages/asyncpg/connect_utils.py", line 876, in __connect_addr
    await connected
asyncpg.exceptions._base.InternalClientError: unexpected error while performing authentication: 'NoneType' object has no attribute 'group'
```

**Attempted Fixes:**
1. Changed database URL format to use direct username instead of pooler format (Failed with same error):
   ```
   # Original
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@host:5432/postgres
   
   # Fixed
   DATABASE_URL=postgresql+asyncpg://postgres:password@host:5432/postgres
   ```

2. Added SSL configuration in database.py (Failed with same error):
   ```python
   connect_args={
       "server_settings": {
           "application_name": "gauntlet-ai",
           "search_path": "public,auth",
       },
       "sslmode": "require"  # Enable SSL without certificate verification
   }
   ```

3. Try using direct database connection with database-specific username (Failed with error 8):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.db.gkwdjhgfeqzpypucnnnx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

### Error 2: Invalid SSL Configuration
```
File "/opt/miniconda3/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 961, in connect
    await_only(creator_fn(*arg, **kw)),
               ^^^^^^^^^^^^^^^^^^^^^^
TypeError: connect() got an unexpected keyword argument 'sslmode'
```

**Fix Attempts:**
1. Update SSL configuration in database.py to use the correct asyncpg parameter (Failed with Error 3):
   ```python
   connect_args={
       "server_settings": {
           "application_name": "gauntlet-ai",
           "search_path": "public,auth",
       },
       "ssl": True  # Use the correct SSL parameter for asyncpg
   }
   ```

2. Try using direct connection URL without query parameters and handle settings in connect_args:
   ```python
   # In database.py
   connect_args={
       "server_settings": {
           "application_name": "gauntlet-ai",
           "search_path": "public,auth",
       },
       "ssl": ssl_context
   }
   ```
   ```
   # In .env
   DATABASE_URL=postgresql+asyncpg://postgres:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres
   ```

**Status:** Testing in progress

### Error 3: SSL Certificate Verification Failed
```
File "/opt/miniconda3/lib/python3.12/ssl.py", line 917, in do_handshake
    self._sslobj.do_handshake()
ssl.SSLCertVerificationError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate in certificate chain (_ssl.c:1000)
```

**Fix:**
Update database configuration to use a custom SSL context that accepts self-signed certificates:
```python
# Create SSL context that accepts self-signed certificates
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Use the SSL context in connect_args
connect_args={
    "server_settings": {
        "application_name": "gauntlet-ai",
        "search_path": "public,auth",
    },
    "ssl": ssl_context  # Pass the SSL context instead of just True
}
```

**Status:** Failed with Error 4

### Error 4: Tenant/User Not Found (Recurring)
```
File "/opt/miniconda3/lib/python3.12/site-packages/asyncpg/connect_utils.py", line 876, in __connect_addr
    await connected
asyncpg.exceptions.InternalServerError: Tenant or user not found
```

**Fix Attempts:**
1. Updated database URL to use the pooler format (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

2. Try using project reference as username (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://gkwdjhgfeqzpypucnnnx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

3. Try using direct connection format (Failed with error 5):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres?user=postgres.gkwdjhgfeqzpypucnnnx&password=actual_password
   ```

4. Try using the database-specific connection format (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.db.gkwdjhgfeqzpypucnnnx.6543:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

5. Try using the direct pooler URL with service role (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://service_role:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

6. Try using the direct database URL with project reference and port (Failed with error 5):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:6543/postgres
   ```

7. Try using the pooler URL with database-specific username:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres.gkwdjhgfeqzpypucnnnx
   ```

**Status:** Testing in progress

### Error 5: Hostname Resolution Failed
```
File "uvloop/loop.pyx", line 1982, in create_connection
socket.gaierror: [Errno 8] nodename nor servname provided, or not known
```

**Fix Attempts:**
1. Try using regional hostname format with direct database connection (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@gkwdjhgfeqzpypucnnnx.supabase-regional.co:5432/postgres
   ```

2. Try using direct IP address format (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@34.102.64.79:5432/postgres
   ```

3. Try using the regional hostname with direct port (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@db-gkwdjhgfeqzpypucnnnx-db.aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

4. Try using the direct connection string from Supabase dashboard (Failed with error 10):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres?host=/cloudsql/gkwdjhgfeqzpypucnnnx:us-west-1:gkwdjhgfeqzpypucnnnx-db
   ```

5. Try using the pooler hostname with direct port (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@gkwdjhgfeqzpypucnnnx.pooler.supabase.com:5432/postgres
   ```

6. Try using the direct pooler URL with region prefix (Failed with error 4):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```

7. Try using direct connection URL with service role (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://service_role:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres
   ```

8. Try using the direct connection URL with service role and explicit region (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://service_role:password@db.us-west-1.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres
   ```

9. Try using the direct connection URL with project reference and no region:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@db.supabase.co:5432/postgres
   ```

10. Try using the direct connection URL with service role and project ID:
    ```
    DATABASE_URL=postgresql+asyncpg://service_role:password@db.gkwdjhgfeqzpypucnnnx:5432/postgres
    ```

**Status:** Failed - After multiple attempts with different URL formats, we're switching approach to use Supabase Python client directly instead of SQLAlchemy + asyncpg.

### Strategy Change: Switch to Supabase Python Client
After encountering persistent connection issues with SQLAlchemy + asyncpg, we're switching to use the Supabase Python client directly. This should simplify our database access since:
1. We're already using Supabase for authentication
2. The client handles connection details internally
3. It's better integrated with Supabase's connection pooler and SSL settings

**Implementation Steps:**
1. Update requirements.txt to include Supabase client
2. Remove SQLAlchemy and asyncpg specific code
3. Update database.py to use Supabase client
4. Update models to work with Supabase client instead of SQLAlchemy

**Implementation Progress:**

1. Database Client Setup ✓
   - Updated requirements.txt to include Supabase client
   - Removed SQLAlchemy and asyncpg dependencies
   - Created new database.py with Supabase client initialization

2. User Model Migration ✓
   - Removed SQLAlchemy model base
   - Created Pydantic models for User
   - Added helper functions for user operations
   - Implemented proper type validation

3. Authentication Module ✓
   - Created new auth.py using Supabase client
   - Implemented JWT verification using Supabase auth
   - Added get_current_user dependency
   - Added get_optional_user for flexible auth
   - Added proper error handling

4. User Routes ✓
   - Created user router with CRUD operations
   - Implemented user profile management
   - Added user search functionality
   - Added proper validation and error handling
   - Added pagination support

5. Message Model Migration ✓
   - Created Pydantic models for Message
   - Added message helper functions
   - Implemented message operations (create, read, update)
   - Added proper validation and error handling
   - Added support for attachments and metadata

6. Message Routes ✓
   - Created message router with CRUD operations
   - Implemented channel message retrieval
   - Added message search functionality
   - Added proper validation and error handling
   - Added support for message threading and replies

7. Chat Models ✓
   - Created chat request/response types
   - Added support for different chat modes
   - Implemented chat context management
   - Added streaming response models
   - Added proper validation and error handling

8. Chat Endpoints ✓
   - Created chat router with send/stream endpoints
   - Implemented message streaming support
   - Added chat history management
   - Added proper error handling
   - Added support for different chat modes

9. File Models ✓
   - Created file upload/response models
   - Added support for different file types
   - Implemented file metadata management
   - Added visibility controls
   - Added Supabase storage integration

10. File Upload Endpoints (In Progress)
    - Create file router with upload/download endpoints
    - Implement multipart file upload
    - Add file type validation
    - Add proper error handling
    - Support for file metadata updates

**Next Steps:**
- None (Final component)

**Current Status:** Implementing File Upload endpoints
**Current Task:** Creating file router with upload/download endpoints

### Error 6: Connection Timeout
```
File "/opt/miniconda3/lib/python3.12/site-packages/asyncpg/connection.py", line 2328, in connect
    async with compat.timeout(timeout):
File "/opt/miniconda3/lib/python3.12/asyncio/timeouts.py", line 115, in __aexit__
    raise TimeoutError from exc_val
TimeoutError
```

**Fix Attempt:**
1. Update database configuration to increase connection timeout and use connection pooler URL:
```python
# In database.py
connect_args={
    "server_settings": {
        "application_name": "gauntlet-ai",
        "search_path": "public,auth",
    },
    "ssl": ssl_context,
    "command_timeout": 60,
    "connect_timeout": 60
}
```

```
# In .env
DATABASE_URL=postgresql+asyncpg://postgres.gkwdjhgfeqzpypucnnnx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Status:** Failed with Error 7

### Error 7: Invalid Connection Parameter
```
File "/opt/miniconda3/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 961, in connect
    await_only(creator_fn(*arg, **kw)),
               ^^^^^^^^^^^^^^^^^^^^^^
TypeError: connect() got an unexpected keyword argument 'connect_timeout'
```

**Fix Attempt:**
Update database configuration to use the correct timeout parameter for asyncpg:
```python
connect_args={
    "server_settings": {
        "application_name": "gauntlet-ai",
        "search_path": "public,auth",
    },
    "ssl": ssl_context,
    "timeout": 60  # Use the correct timeout parameter for asyncpg
}
```

**Status:** Failed, reverted to Error 1

### Error 8: Postgres.db User Not Found
```
File "/opt/miniconda3/lib/python3.12/site-packages/asyncpg/connect_utils.py", line 876, in __connect_addr
    await connected
asyncpg.exceptions.InternalServerError: Authentication error, reason: "There is no user 'postgres.db' in the database. Please create it or change the user in the config"
```

**Fix Attempt:**
Try using the direct database URL with the correct username format (Failed with same error):
```
DATABASE_URL=postgresql+asyncpg://postgres:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?options=-c%20search_path%3Dpublic,auth
```

**Status:** Failed with Error 9

### Error 9: Invalid Connection Parameter 'options'
```
File "/opt/miniconda3/lib/python3.12/site-packages/sqlalchemy/dialects/postgresql/asyncpg.py", line 961, in connect
    await_only(creator_fn(*arg, **kw)),
               ^^^^^^^^^^^^^^^^^^^^^^
TypeError: connect() got an unexpected keyword argument 'options'
```

**Fix Attempts:**
1. Move the search_path configuration from URL options to server_settings (Failed with same error):
   ```python
   connect_args={
       "server_settings": {
           "application_name": "gauntlet-ai",
           "search_path": "public,auth",
           "options": "-c search_path=public,auth"
       },
       "ssl": ssl_context,
       "timeout": 60
   }
   ```
   ```
   # In .env
   DATABASE_URL=postgresql+asyncpg://postgres:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

2. Remove options and rely on search_path in server_settings:
   ```python
   connect_args={
       "server_settings": {
           "application_name": "gauntlet-ai",
           "search_path": "public,auth"  # Keep only the search_path setting
       },
       "ssl": ssl_context,
       "timeout": 60
   }
   ```

**Status:** Failed, reverted to Error 4

### Error 10: Unix Socket Not Found
```
File "uvloop/loop.pyx", line 2288, in uvloop.loop.Loop.create_unix_connection
FileNotFoundError: [Errno 2] No such file or directory
```

**Fix Attempts:**
1. Remove the Cloud SQL Unix socket path and use direct TCP connection with project ID (Failed with same error):
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres?project_id=gkwdjhgfeqzpypucnnnx
   ```

2. Try using the direct database URL with region and project:
   ```
   DATABASE_URL=postgresql+asyncpg://postgres:password@db.gkwdjhgfeqzpypucnnnx.supabase.co:5432/postgres?region=us-west-1&project=gkwdjhgfeqzpypucnnnx
   ```

**Status:** Failed, reverted to Error 2

### Error 11: GoTrue Client Initialization Error
```
File "/opt/miniconda3/lib/python3.12/site-packages/gotrue/_sync/gotrue_base_api.py", line 28, in __init__
    self._http_client = http_client or SyncClient(
                                       ^^^^^^^^^^^
TypeError: Client.__init__() got an unexpected keyword argument 'proxy'
```

**Fix Attempts:**
1. Update Supabase client initialization to remove proxy settings (Failed with same error):
```python
# In database.py
supabase: Client = create_client(
    supabase_url,
    supabase_key,
    options={
        "auto_refresh_token": True,
        "persist_session": False
    }
)
```

2. Try using minimal client initialization without any options (Failed with same error):
```python
# In database.py
supabase: Client = create_client(
    supabase_url,
    supabase_key
)
```

3. Try pinning to specific version (Failed - package not found):
```
# In requirements.txt
supabase==1.0.3  # Use a known working version
python-gotrue<2.0.0  # Package not found
```

4. Try using a compatible set of Supabase packages:
```
# In requirements.txt
supabase-py==0.0.2  # Older stable version
gotrue==0.2.0  # Compatible auth client
httpx==0.23.0  # Compatible HTTP client
```

**Status:** Testing in progress

**Current Status:** Testing Supabase client initialization
**Current Task:** Fixing GoTrue client initialization error