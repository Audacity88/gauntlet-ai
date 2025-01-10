# Schema Update Changes Guide

This guide outlines all necessary changes to align the codebase with the new schema from `20240318000008_rebuild_schema.sql`.

## 1. Frontend Type Changes (Already Completed) ✅

Updated `types/schema.ts`:
- Changed all IDs to UUID strings
- Added `profile_id` fields
- Aligned message fields with schema
- Added proper type safety with never types
- Removed unused interfaces

## 2. Frontend Component Changes (COMPLETED) ✅

### A. ✅ `useRealtimeMessages.ts` (COMPLETED)
- Updated message queries to include profile_id
- Modified optimistic updates to include profile_id
- Updated message type checking (content vs message field)
- Fixed message sorting to use inserted_at consistently
- Added proper profile_id handling for both DMs and channels
- Fixed timestamp field handling with proper type guards

### B. ✅ `MessageList.tsx` (COMPLETED)
- Updated to use UUID IDs consistently
- Updated optimistic message creation with profile_id
- Fixed field name handling for DMs vs channels
- Added proper profile_id handling
- Improved type safety and error handling

### C. ✅ `Chat.tsx` (COMPLETED)
- Changed all IDs to UUID strings
- Removed private channel logic
- Added proper user handling for DMs
- Added channel deletion functionality
- Fixed user ID handling
- Improved UI/UX with better error states

### D. ✅ `useFileUpload.ts` (COMPLETED)
- Updated message_id type to UUID string
- Updated attachment creation to handle UUID message IDs
- Updated file deletion to work with UUID references
- Added proper TypeScript types for responses
- Improved error handling

### E. ✅ `MessageBubble.tsx` (COMPLETED)
- Updated message type handling for content field
- Updated attachment handling for UUID message IDs
- Removed reaction handling
- Added proper profile_id support
- Improved UI with avatar and better message layout
- Added proper type safety

## 3. Backend Changes Needed

### A. ✅ Models Update (`backend/app/models/`) (COMPLETED)
```python
# message.py ✅
- Updated id fields to UUID type
- Added profile_id relationships
- Updated foreign key relationships
- Added proper cascade behavior

# channel.py ✅
- Changed id to UUID type
- Updated relationships for new UUID fields
- Added profile_id field and relationship
- Added proper cascade behavior

# user.py ✅
- Changed id to UUID type
- Added Profile model
- Updated relationships for new schema
- Added proper cascade behavior

# direct_message.py ✅
- Changed id to UUID type
- Added profile_id relationship
- Updated sender/recipient relationships
- Added proper cascade behavior

# message_attachment.py ✅
- Created separate models for channel and DM attachments
- Added UUID fields
- Set up proper relationships
- Added cascade behavior
```

### B. ✅ API Endpoints Update (COMPLETED)
```python
# endpoints/files.py ✅
- Updated to handle UUID message IDs
- Split into separate channel/DM endpoints
- Added proper file path handling with UUIDs
- Added proper error handling for UUID validation
- Added separate delete endpoints for each type

# endpoints/messages.py ✅
- Created new endpoints for channel messages
- Created new endpoints for direct messages
- Added proper UUID and profile_id handling
- Added pagination support using inserted_at
- Added proper error handling and validation
```

### C. ✅ Message Schemas (COMPLETED)
```python
# schemas/message.py ✅
- Created MessageBase schema with content and user validation
- Created MessageCreate schema for input validation
- Created Message response schema with attachments
- Created DirectMessageBase schema with sender/recipient
- Created DirectMessageCreate schema for DM input
- Created DirectMessage response schema with attachments
- Created MessageAttachment schemas for both types
- Added UUID4 field validation
- Added content length validation (1-10000 chars)
- Added proper field descriptions
- Added ORM mode configuration
```

### D. ✅ User Schemas (COMPLETED)
```python
# schemas/user.py ✅
- Created UserBase schema with email validation
- Created UserCreate schema for input validation
- Created User response schema with profiles
- Created ProfileBase schema with username validation
- Created ProfileCreate schema with user_id
- Created Profile response schema with all fields
- Added UUID4 field validation
- Added email validation using EmailStr
- Added username validation (3-50 chars, alphanumeric)
- Added proper field descriptions
- Added ORM mode configuration
- Added extended schemas for user/profile relationships
```

### E. 🚧 Database Migrations Needed (TODO)
```sql
-- Create new migration for:
1. Convert existing IDs to UUIDs
   - Generate new UUIDs for all tables
   - Update foreign key references
   - Ensure data integrity during conversion

2. Add profile_id columns
   - Create profiles table
   - Add profile_id to messages
   - Add profile_id to channel_members
   - Add profile_id to direct_messages

3. Update foreign key constraints
   - Add ON DELETE CASCADE where needed
   - Add ON UPDATE CASCADE for UUIDs
   - Add proper indexes for foreign keys

4. Add missing indexes
   - Add index on inserted_at for pagination
   - Add index on channel_id for message queries
   - Add compound index for DM queries
   - Add index on username for profile lookups
```

## 4. Supabase Changes Needed

### A. ✅ RLS Policies Update (COMPLETED)
```sql
-- Updated policies for:
1. channels table (UUID fields)
2. messages table (profile_id access)
3. channel_members table (profile_id)
4. attachments table (UUID references)
```

### B. ✅ Functions Update (COMPLETED)
```sql
-- Updated functions for:
1. send_direct_message (add profile_id)
2. join_channel (add profile_id)
3. Any other custom functions using IDs
```

## 5. Testing Required

### A. 🚧 Frontend Testing (TODO)
```typescript
- Test channel creation with UUID
- Test message sending with new fields
- Test file uploads with UUID messages
- Test DM creation and sending
- Test message editing with new field names
- Test attachment handling with UUID references
```

### B. 🚧 Backend Testing (TODO)
```python
- Test UUID handling in all endpoints
- Test profile_id validation
- Test attachment operations
- Test database queries performance
- Test error handling with invalid UUIDs
```

## 6. Migration Steps

### 1. ✅ Preparation (COMPLETED)
```bash
- Backup existing database
- Create test environment
- Prepare rollback plan
```

### 2. 🚧 Execution Order (IN PROGRESS)
```bash
1. ✅ Apply schema changes
2. ✅ Update backend models
3. ✅ Update backend endpoints
4. ✅ Update frontend code
5. ✅ Create message schemas
6. ✅ Create user schemas
7. 🚧 Create database migrations (IN PROGRESS)
8. 🚧 Deploy frontend changes (TODO)
```

### 3. 🚧 Verification (TODO)
```bash
- Verify data integrity
- Test all main functionalities
- Monitor performance
- Check error handling
- Verify type safety
```

## Notes

- All ID fields are now UUIDs
- Profile ID is required in many operations
- Message content field replaces message field in DMs
- Message field replaces content field in channels
- Timestamps use inserted_at consistently across all tables
- RLS policies need careful updates
- Consider adding migration path for existing data if needed 