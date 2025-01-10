# Schema Update Implementation Plan

## Major Schema Changes

### 1. Users Table (formerly Profiles)
- `profiles` table renamed to `users`
- Removed `last_seen` column
- Added `created_at` column

### 2. Channels Table
- Changed `id` from UUID to BIGINT
- Renamed `name` to `slug`
- Removed `description` and `is_private`
- Renamed `created_at` to `inserted_at`
- Removed `updated_at`

### 3. Messages Table
- Changed `id` from UUID to BIGINT
- Renamed `content` to `message`
- Changed `channel_id` from UUID to BIGINT
- Removed `is_ai_generated`, `parent_id`, `updated_at`
- Renamed `created_at` to `inserted_at`

### 4. Removed Tables
- `channel_members`
- `message_attachments`
- `message_reactions`

### 5. Direct Messages Changes
- Added `profile_id` to both `direct_messages` and `direct_message_members`
- Changed `sender_id` to `user_id` in `direct_messages`

## Frontend Components to Update

### 1. Hooks
- `useChannels.ts`
  - Update channel type definitions
  - Modify queries to use BIGINT IDs
  - Remove private/description handling
  - Update channel member handling (table removed)

- `useRealtimeMessages.ts`
  - Update message interface
  - Modify queries to use BIGINT IDs
  - Remove attachment/reaction handling
  - Update timestamp field names
  - Add profile_id handling for DMs

- `useDirectMessages.ts`
  - Update DM interfaces
  - Add profile_id to member creation
  - Update queries to include profile_id

### 2. Components
- `MessageBubble.tsx`
  - Remove reaction handling
  - Remove attachment display
  - Update message field references

- `MessageList.tsx`
  - Update message type definitions
  - Remove reaction/attachment UI
  - Update timestamp handling

- `ChannelList.tsx`
  - Update channel interface
  - Remove private channel UI
  - Remove channel description
  - Update ID type handling

- `EmojiPicker.tsx`
  - Consider removing if reactions are no longer supported
  - Or keep for future re-implementation

### 3. Pages
- `Messages.tsx`
  - Update channel/message interfaces
  - Remove reaction/attachment handling
  - Update ID type handling

- `Chat.tsx`
  - Update channel interfaces
  - Remove private channel logic
  - Update ID type handling

## Implementation Progress

### ✅ 1. Type Definitions (COMPLETED)
- Created `src/types/schema.ts` with:
  - Base table interfaces matching new schema
  - Extended interfaces for UI components
  - Updated field types (UUID to BIGINT where needed)
  - Removed deprecated fields and tables
  - Added proper type definitions for enums

### ✅ 2. Update Core Hooks (COMPLETED)
- ✅ Updated `useChannels.ts`:
  - Changed to use new schema types
  - Removed channel_members functionality
  - Updated field names and types
  - Simplified channel operations
  - Added proper creator relationship
- ✅ Updated `useRealtimeMessages.ts`:
  - Changed to use new schema types
  - Updated field names (content → message, created_at → inserted_at)
  - Removed reactions and attachments
  - Added proper user joins
  - Updated cursor handling
  - Added profile_id for DMs
- ✅ Updated `useDirectMessages.ts`:
  - Fixed type imports and added missing types
  - Updated Supabase queries to select all required fields
  - Added proper type casting for channel data
  - Fixed member mapping to include all required fields
  - Added proper typing for last message
  - Ensured data structure matches DirectMessageChannelWithMembers type

### ✅ 3. Update Components (COMPLETED)
- ✅ Updated `MessageBubble.tsx`:
  - Changed to use new schema types
  - Removed reactions and attachments
  - Updated message field names
  - Added proper user handling with avatar
  - Improved null safety
  - Simplified message actions
- ✅ Updated `MessageList.tsx`:
  - Changed to use new schema types
  - Added support for both UUID and BIGINT IDs
  - Removed reactions functionality
  - Added proper user data handling
  - Added null checks for user data
  - Improved accessibility
- ✅ Updated Channel List in `Messages.tsx`:
  - Changed to use new schema types
  - Added support for both UUID and BIGINT IDs
  - Removed private channel UI
  - Updated channel creation to use slug
  - Added proper user data handling
  - Improved auth session handling
  - Removed channel membership logic
- ✅ Removed `EmojiPicker.tsx`:
  - Component removed as reactions are no longer supported
  - Cleaned up related imports and dependencies

### ✅ 4. Update Pages (COMPLETED)
- ✅ Updated `Chat.tsx`:
  - Added schema type imports
  - Updated ChatTarget interface for both UUID and BIGINT IDs
  - Removed private channel logic
  - Updated channel creation to use slug
  - Removed channel member count display
  - Implemented DM creation functionality
  - Added proper type definitions
  - Fixed user data handling
  - Improved error handling

### ⏳ 5. Testing (NEXT)
- Test channel creation/listing
- Test message sending/receiving
- Test DM functionality
- Verify realtime updates still work

## Notes
- All UUID to BIGINT conversions need careful handling in TypeScript
- Some features (reactions, attachments) are removed but could be re-implemented later
- Consider adding migration path for existing data if needed
- Update any environment variables or constants that might reference old column names 