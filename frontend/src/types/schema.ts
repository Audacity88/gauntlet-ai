// Database table interfaces
export interface User {
  id: string  // UUID
  username: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
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
  id: string  // UUID
  channel_id: string  // UUID
  user_id: string  // UUID
  profile_id: string  // UUID
  message: string
  inserted_at: string
  content?: never  // Ensure content property doesn't exist
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id: string  // UUID
  message_id: string  // UUID
  filename: string
  file_path: string
  file_size: number
  content_type: string
  created_at: string
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
  id: string  // UUID
  channel_id: string  // UUID
  user_id: string  // UUID
  profile_id: string  // UUID
  content: string
  created_at: string
  updated_at: string
  message?: never  // Ensure message property doesn't exist
  attachments?: MessageAttachment[]
}

// Extended interfaces for UI components
export interface ChannelWithDetails extends Channel {
  creator?: User
}

export interface MessageWithUser extends Message {
  user: User
}

export interface DirectMessageWithUser extends DirectMessage {
  user: User
}

export interface DirectMessageChannelWithMembers extends DirectMessageChannel {
  members: (DirectMessageMember & { user: User })[]
  last_message?: DirectMessage
  unread_count?: number
} 