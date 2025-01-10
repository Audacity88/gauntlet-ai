import { useEffect, useRef, useState } from 'react'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { MessageBubble } from './MessageBubble'
import { FileUpload } from './FileUpload'
import { useFileUpload } from '../hooks/useFileUpload'
import { useAuth } from '../hooks/useAuth'
import { Message, DirectMessage, DirectMessageWithUser, MessageWithUser, User } from '../types/schema'
import { Paperclip } from 'lucide-react'

interface MessageListProps {
  channelId: string  // Now always UUID
  chatType?: 'channel' | 'dm'
  markChannelAsRead?: (channelId: string) => Promise<void>
}

// Helper to create an optimistic message
const createOptimisticMessage = (
  content: string, 
  currentUser: User, 
  channelId: string, 
  chatType: 'channel' | 'dm'
): MessageWithUser | DirectMessageWithUser => {
  const now = new Date().toISOString()
  const tempId = `temp-${Date.now()}`

  // Get profile ID from user
  const profile_id = currentUser.id // In the new schema, profile.id is the same as user.id

  const base = {
    id: tempId,
    channel_id: channelId,
    user_id: currentUser.id,
    profile_id,
    user: currentUser,
  }

  if (chatType === 'dm') {
    return {
      ...base,
      content,
      created_at: now,
      updated_at: now,
    } as DirectMessageWithUser
  }

  return {
    ...base,
    message: content, // Use message field for channels
    inserted_at: now,
    created_at: now,
    updated_at: now,
  } as MessageWithUser
}

export function MessageList({ 
  channelId, 
  chatType = 'channel',
  markChannelAsRead 
}: MessageListProps) {
  const {
    messages: serverMessages,
    isLoading,
    error,
    hasMore,
    loadMore,
    sendMessage,
    updateMessage,
    users
  } = useRealtimeMessages({ channelId, chatType })

  const [optimisticMessages, setOptimisticMessages] = useState<(MessageWithUser | DirectMessageWithUser)[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { uploadFile, deleteFile, isUploading } = useFileUpload()
  const { user } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Combine server messages with optimistic messages
  const messages = [...serverMessages]
  optimisticMessages.forEach(optMsg => {
    // Only add optimistic message if we don't have a real message with matching content
    const hasRealMessage = messages.some(m => {
      const optContent = chatType === 'dm' ? optMsg.content : (optMsg as MessageWithUser).message
      const msgContent = chatType === 'dm' ? m.content : (m as MessageWithUser).message
      const timeDiff = Math.abs(
        new Date(chatType === 'dm' ? m.created_at : (m as MessageWithUser).inserted_at).getTime() - 
        new Date(chatType === 'dm' ? optMsg.created_at : (optMsg as MessageWithUser).inserted_at).getTime()
      )
      return m.user_id === optMsg.user_id && 
             msgContent === optContent && 
             timeDiff < 5000 // Within 5 seconds
    })
    
    if (!hasRealMessage) {
      messages.push(optMsg)
    }
  })

  // Clean up old optimistic messages
  useEffect(() => {
    setOptimisticMessages(prev => 
      prev.filter(optMsg => {
        const hasRealMessage = serverMessages.some(m => {
          const optContent = chatType === 'dm' ? optMsg.content : (optMsg as MessageWithUser).message
          const msgContent = chatType === 'dm' ? m.content : (m as MessageWithUser).message
          const timeDiff = Math.abs(
            new Date(chatType === 'dm' ? m.created_at : (m as MessageWithUser).inserted_at).getTime() - 
            new Date(chatType === 'dm' ? optMsg.created_at : (optMsg as MessageWithUser).inserted_at).getTime()
          )
          return m.user_id === optMsg.user_id && 
                 msgContent === optContent && 
                 timeDiff < 5000
        })
        return !hasRealMessage
      })
    )
  }, [serverMessages, chatType])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Set up infinite scroll
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current
    if (!loadMoreElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first.isIntersecting && hasMore && !isLoading) {
          const oldestMessage = messages[0]
          if (oldestMessage) {
            // Handle both channel messages and DMs
            const timestamp = chatType === 'dm' 
              ? (oldestMessage as DirectMessageWithUser).created_at 
              : (oldestMessage as MessageWithUser).inserted_at
            if (timestamp) loadMore(timestamp)
          }
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreElement)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, isLoading, messages, loadMore, chatType])

  // Mark messages as read when viewing them
  useEffect(() => {
    if (chatType === 'dm' && !isLoading && messages.length > 0 && markChannelAsRead) {
      markChannelAsRead(channelId as string).catch((err: Error) => {
        console.error('Error marking messages as read:', err)
      })
    }
  }, [chatType, channelId, isLoading, messages.length, markChannelAsRead])

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center text-center">
        <div className="text-red-500 mb-2">
          {error.message === 'Not a member of this channel'
            ? 'You are not a member of this channel. Please join the channel to view messages.'
            : `Error loading messages: ${error.message}`
          }
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm text-blue-500 hover:text-blue-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (isLoading && !messages.length) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 space-y-6 py-6">
          {/* Loading indicator for more messages */}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 text-center">
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500 mx-auto" />
              ) : (
                // Spacer for intersection observer
                <div className="h-4" />
              )}
            </div>
          )}
          
          {messages.map((message) => {
            // Skip messages with undefined user_id
            if (!message.user_id) {
              console.warn('Message has no user_id:', message)
              return null
            }

            const messageUser = users?.find(u => u.id === message.user_id) || message.user
            if (!messageUser) {
              console.warn('No user data found for message:', message)
              return (
                <div key={message.id} className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded w-full max-w-md" />
                </div>
              )
            }

            const typedMessage = chatType === 'dm' 
              ? message as DirectMessageWithUser 
              : message as MessageWithUser

            return (
              <MessageBubble
                key={message.id}
                message={typedMessage}
                user={messageUser}
                isOwnMessage={message.user_id === user?.id}
                onEdit={async (content) => {
                  await updateMessage(message.id, content)
                }}
                onDeleteAttachment={async (attachmentId) => {
                  await deleteFile(attachmentId)
                }}
              />
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              console.log('Form submitted');
              const form = e.target as HTMLFormElement
              const input = form.elements.namedItem('message') as HTMLInputElement
              const content = input.value.trim()
              console.log('Message content:', content);

              if ((content || selectedFile) && user) {
                console.log('Attempting to send message...');
                // Clear input immediately
                input.value = ''
                
                // Find the current user's full profile from users array
                const currentUser = users?.find(u => u.id === user.id) || {
                  ...user,
                  id: user.id,
                  // Add any other required user fields
                }
                if (!user) {
                  console.error('No authenticated user');
                  return
                }

                // Create optimistic message if there's content
                if (content) {
                  console.log('Creating optimistic message');
                  const optimisticMessage = createOptimisticMessage(content, currentUser, channelId, chatType)
                  setOptimisticMessages(prev => [...prev, optimisticMessage])
                }
                
                try {
                  // Send message in background
                  console.log('Calling sendMessage...');
                  const message = await sendMessage(content || '')
                  console.log('Message sent:', message);
                  
                  // If there's a file, upload it
                  if (selectedFile) {
                    await uploadFile(selectedFile, message.id)
                    setSelectedFile(null)
                  }
                } catch (error) {
                  console.error('Failed to send message:', error)
                  // Remove optimistic message if there was content
                  if (content) {
                    setOptimisticMessages(prev => prev.filter(m => {
                      const msgContent = 'content' in m ? m.content : m.message
                      return msgContent !== content
                    }))
                  }
                  alert('Failed to send message. Please try again.')
                }
              }
            }}
            className="space-y-4"
          >
            {selectedFile && (
              <div className="px-2">
                <FileUpload
                  selectedFile={selectedFile}
                  onFileSelect={setSelectedFile}
                  onRemove={() => setSelectedFile(null)}
                  isUploading={isUploading}
                />
              </div>
            )}
            
            {/* Message Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="message"
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                disabled={isUploading}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-800 hover:text-white rounded-full transition-colors"
                  disabled={isUploading}
                >
                  <Paperclip className="w-5 h-5" />
                  <input
                    id="file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setSelectedFile(file)
                    }}
                    accept="image/*,application/pdf,.doc,.docx,.txt"
                  />
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 