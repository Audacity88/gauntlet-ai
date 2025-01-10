# Direct Message Schema Simplification

## Overview
This document describes the changes made to simplify the direct messaging schema and the required code updates to support these changes.

## Schema Changes

### Tables Removed
- `user_status` table removed (status info moved to profiles)
- `dm_member_profiles` table removed (redundant with the view)

### Table Modifications
1. `profiles` table:
   - Added `status` column (TEXT, default 'OFFLINE')
   - Added `last_seen` column (TIMESTAMP WITH TIME ZONE)
   - Data migrated from `user_status` table

### Views
1. `direct_message_members` view:
   ```sql
   CREATE OR REPLACE VIEW direct_message_members AS
   SELECT 
       dcm.id,
       dcm.channel_id,
       dcm.user_id,
       p.id as profile_id,
       dcm.last_read_at,
       dcm.created_at,
       p.username,
       p.full_name,
       p.avatar_url
   FROM dm_channel_members dcm
   JOIN profiles p ON p.id = dcm.user_id;
   ```

### New Indexes
1. On `dm_channel_members`:
   - `idx_dm_channel_members_channel_user` (channel_id, user_id)
   - `idx_dm_channel_members_user` (user_id)
2. On `profiles`:
   - `idx_profiles_status` (status)

### Functions
Added `update_direct_message_member_last_read` function:
```sql
CREATE OR REPLACE FUNCTION update_direct_message_member_last_read(
    p_member_id uuid,
    p_last_read_at timestamp with time zone
) RETURNS void
```
- Purpose: Securely update the last_read_at timestamp for DM members
- Security: SECURITY DEFINER with auth checks
- Permissions: Granted to authenticated users

## Code Update Requirements

### Frontend Changes
The current frontend code in `useDirectMessages.ts` is already compatible with these changes as it:
1. Uses the correct view name (`direct_message_members`)
2. Uses the correct field names from the view
3. Uses the `update_direct_message_member_last_read` function

### Backend/Database Changes
No additional backend changes required as:
1. All necessary tables and views are in place
2. Required indexes are created
3. Security policies and permissions are properly set

## Benefits
1. Simplified schema with fewer tables
2. Improved query performance with additional indexes
3. Better security with proper function-level access control
4. Consolidated user status information in profiles table
5. Reduced data redundancy

## Migration Path
The changes are applied through two migrations:
1. `20240318000036_simplify.sql`: Initial schema simplification
2. `20240318000037_cleanup_dm_schema.sql`: Final cleanup and function creation

These migrations are designed to be non-destructive and maintain data integrity throughout the process. 