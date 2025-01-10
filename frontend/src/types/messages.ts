export interface Message {
  id: string
  channel_id: string
  user_id: string
  profile_id: string
  content: string
  created_at: string
  inserted_at: string
  updated_at: string
}

export interface MessageWithUser extends Message {
  user: User
}

export interface DirectMessage {
  id: string
  channel_id: string
  user_id: string
  profile_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface DirectMessageWithUser extends DirectMessage {
  user: User
}

export type AnyMessage = MessageWithUser | DirectMessageWithUser 