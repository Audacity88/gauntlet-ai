# API Testing Notes

## Current Status (March 21, 2024)
Working on: Chat Endpoint Implementation
Status: In Progress - Schema Mismatch

### Test User Details
- ID: 98250a74-c387-404a-a834-9ae7f5eaab17
- Email: testuser@gmail.com

### Current Issue
Schema mismatch between Message model and database table:
1. Model expects:
   - message_type
   - parent_id
   - attachments
   - metadata
   - updated_at
   - deleted_at
2. Database table has:
   - user_id (not in model)
   - channel_id (required in DB, optional in model)
   - profile_id
   - content
   - inserted_at

### Next Steps
1. Update messages table schema to include:
   - message_type TEXT
   - parent_id UUID
   - attachments JSONB
   - metadata JSONB
   - updated_at TIMESTAMPTZ
   - deleted_at TIMESTAMPTZ
2. Make channel_id optional in database
3. Remove user_id from database (using profile_id instead)
4. Test chat endpoint again after schema update

### Test Commands
```bash
curl -X POST 'http://localhost:8001/api/chat/send' \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello, how are you?",
    "target_user_id": "98250a74-c387-404a-a834-9ae7f5eaab17",
    "message_id": null,
    "is_direct_message": false
  }'
```
