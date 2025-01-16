# DM API Testing Notes

## Current Status (2025-01-16)

### Working Components
1. DM Channel Creation
   - Successfully creates/finds channel via `find_or_create_dm_channel` RPC
   - Returns channel data through APIError but data is valid
   - Example response: `{'channel_id': '767d9ff9-6b76-4abc-9eb3-6a941cbbf4c5', 'created_at': '2025-01-16T07:11:49.798671+00:00'}`

2. Message Creation
   - Messages are being created in the database
   - Returns error but operation succeeds
   - Using direct_messages table correctly

### Issues
1. APIResponse await error in three places:
   - Getting DM messages
   - Creating messages
   - Retrieving chat context

## Proposed Solutions

### 1. Replace RPC with Direct Query for Messages
Instead of using `get_dm_messages_with_profiles` RPC function, use direct query:
```sql
SELECT 
    dm.*,
    p.username,
    p.full_name,
    p.avatar_url
FROM direct_messages dm
JOIN profiles p ON p.id = dm.profile_id
WHERE dm.channel_id = :channel_id
ORDER BY dm.created_at DESC
LIMIT :limit
```

Expected Result:
- Avoid RPC await issues
- Get same data structure
- Maintain proper ordering and limits

### 2. Use Supabase Function for Message Creation
Replace direct insert with `send_direct_message` function:
```sql
-- Function signature
send_direct_message(
    p_channel_id uuid,
    p_user_id uuid,
    p_profile_id uuid,
    p_content text,
    p_message_type text DEFAULT 'text',
    p_parent_id uuid DEFAULT NULL,
    p_attachments jsonb DEFAULT '[]',
    p_metadata jsonb DEFAULT '{}'
)
```

Expected Result:
- More reliable message creation
- Built-in validation
- Proper error handling

### 3. Improve Error Handling
Add wrapper for Supabase calls:
```python
async def handle_supabase_call(call_func):
    try:
        response = await call_func()
        return response.data if hasattr(response, 'data') else None
    except APIError as e:
        if e.args and isinstance(e.args[0], (dict, list)):
            return e.args[0]
        print(f"API Error: {str(e)}")
        return None
```

Expected Result:
- Consistent error handling
- Proper data extraction from both success and error cases
- Better logging and debugging

## Testing Plan
1. Test DM channel creation (already working)
2. Implement and test direct query for messages
3. Test message creation with Supabase function
4. Verify message retrieval with profiles
5. Test error handling with various scenarios

## Success Criteria
- Messages are properly created and stored
- Messages can be retrieved with profile information
- No APIResponse await errors
- Proper error handling for actual error cases
- Maintain existing functionality while improving reliability
