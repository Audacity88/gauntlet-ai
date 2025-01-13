// Database table interfaces
export interface User {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  created_at?: string
  updated_at?: string
}

export interface Channel {
  id: string  // UUID
  slug: string
  created_by: string  // UUID
  inserted_at: string
}

export interface ChannelMember {
  id: string  // UUID
  channel_id: string  // UUID
  user_id: string  // UUID
  profile_id: string  // UUID
  role: string
  inserted_at: string
}

export interface Message {
  id: string
  channel_id: string
  user_id: string
  profile_id: string
  content?: string
  message?: string
  attachments?: MessageAttachment[]
  parent_id?: string | null
  created_at: string
  updated_at: string
  inserted_at?: string
}

export interface MessageAttachment {
  id: string
  message_id: string
  filename: string
  file_path: string
  content_type: string
  size: number
  url: string
  created_at: string
  updated_at: string
}

// Direct Message interfaces
export interface DirectMessageChannel {
  id: string  // UUID
  created_at: string
  updated_at: string
}

export interface DirectMessageMember {
  id: string  // UUID
  channel_id: string  // UUID
  user_id: string  // UUID
  profile_id: string  // UUID
  last_read_at: string
  created_at: string
}

export interface DirectMessage {
  id: string
  channel_id: string
  user_id: string
  profile_id: string
  content: string
  attachments?: MessageAttachment[]
  parent_id?: string | null
  created_at: string
  updated_at: string
}

// Extended interfaces for UI components
export interface ChannelWithDetails extends Channel {
  creator?: User
}

export interface MessageWithUser extends Message {
  user: User
  profile: User
}

export interface DirectMessageWithUser extends DirectMessage {
  user: User
  profile: User
}

export interface DirectMessageChannelWithMembers extends DirectMessageChannel {
  members: (DirectMessageMember & { user: User })[]
  last_message?: DirectMessage
  unread_count?: number
}

export type AnyMessage = MessageWithUser | DirectMessageWithUser; 