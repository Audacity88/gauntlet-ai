import { useEffect, useRef, useState } from 'react'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { MessageBubble } from './MessageBubble'
import { FileUpload } from './FileUpload'
import { useFileUpload } from '../hooks/useFileUpload'
import { useAuth } from '../hooks/useAuth'
import { Message, DirectMessage, DirectMessageWithUser, MessageWithUser, User } from '../types/schema'
import { Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { SearchBar } from './SearchBar'
import { MessageInput } from './MessageInput'

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
  const [searchQuery, setSearchQuery] = useState('')
  const {
    messages: serverMessages,
    isLoading,
    error,
    hasMore,
    loadMore,
    sendMessage,
    updateMessage,
    users
  } = useRealtimeMessages({ channelId, chatType, searchQuery })

  const [optimisticMessages, setOptimisticMessages] = useState<(MessageWithUser | DirectMessageWithUser)[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { uploadFile, deleteFile, isUploading } = useFileUpload({ chatType: chatType || 'channel' })
  const { user } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Combine server messages with optimistic messages
  const messages = [...serverMessages]
  optimisticMessages.forEach(optMsg => {
    // Only add optimistic message if it's not already in server messages
    const hasRealMessage = serverMessages.some(m => m.id === optMsg.id || (
      m.user_id === optMsg.user_id && 
      ((chatType === 'dm' ? m.content : (m as MessageWithUser).message) === 
       (chatType === 'dm' ? optMsg.content : (optMsg as MessageWithUser).message)) &&
      Math.abs(
        new Date(chatType === 'dm' ? m.created_at : (m as MessageWithUser).inserted_at).getTime() - 
        new Date(chatType === 'dm' ? optMsg.created_at : (optMsg as MessageWithUser).inserted_at).getTime()
      ) < 5000 // Within 5 seconds
    ))
    
    if (!hasRealMessage) {
      messages.push(optMsg)
    }
  })

  // Clean up old optimistic messages
  useEffect(() => {
    setOptimisticMessages(prev => 
      prev.filter(optMsg => {
        // Keep optimistic message if it's not in server messages
        const hasRealMessage = serverMessages.some(m => m.id === optMsg.id || (
          m.user_id === optMsg.user_id && 
          ((chatType === 'dm' ? m.content : (m as MessageWithUser).message) === 
           (chatType === 'dm' ? optMsg.content : (optMsg as MessageWithUser).message)) &&
          Math.abs(
            new Date(chatType === 'dm' ? m.created_at : (m as MessageWithUser).inserted_at).getTime() - 
            new Date(chatType === 'dm' ? optMsg.created_at : (optMsg as MessageWithUser).inserted_at).getTime()
          ) < 5000
        ))
        return !hasRealMessage
      })
    )
  }, [serverMessages, chatType])

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom()
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

  // Update the message sending logic
  const handleSendMessage = async (content: string) => {
    if (!user) throw new Error('No user found')

    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
    const messageData = {
      content,
      channel_id: channelId,
      user_id: user.id,
      profile_id: user.id, // In our schema, profile_id is the same as user_id
      attachments: []
    }

    const { data: message, error } = await supabase
      .from(table)
      .insert(messageData)
      .select('*, profile:profiles(*)')
      .single()

    if (error) throw error
    return message
  }

  // Update the file upload logic
  const handleFileUpload = async (file: File, messageId: string) => {
    try {
      // Generate unique filename
      const timestamp = new Date().getTime()
      const uniqueFilename = `${timestamp}-${file.name}`
      const filePath = `attachments/${messageId}/${uniqueFilename}`

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(filePath)

      // Create attachment object
      const attachment = {
        id: `${timestamp}`,
        message_id: messageId,
        filename: file.name,
        file_path: filePath,
        content_type: file.type,
        size: file.size,
        url: publicUrl
      }

      // Get current message
      const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      const { data: currentMessage, error: fetchError } = await supabase
        .from(table)
        .select('*, profile:profiles(*)')
        .eq('id', messageId)
        .single()

      if (fetchError) throw fetchError

      const existingAttachments = currentMessage?.attachments || []
      const newAttachments = [...existingAttachments, attachment]

      // Update message with attachment
      const { data: updatedMessage, error: updateError } = await supabase
        .rpc(
          chatType === 'dm' ? 'update_dm_with_attachment' : 'update_message_with_attachment',
          {
            p_message_id: messageId,
            p_attachments: newAttachments
          }
        )

      if (updateError) throw updateError

      // Return the message with profile data
      return {
        ...updatedMessage,
        profile: currentMessage.profile
      }
    } catch (error) {
      console.error('File upload failed:', error)
      throw error
    }
  }

  // Update the form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const input = form.querySelector('input[type="text"]') as HTMLInputElement
    const content = input.value.trim()

    if (!content && !selectedFile) return

    let sentMessage: MessageWithUser | DirectMessageWithUser | null = null;
    try {
      // Send the message first
      sentMessage = await handleSendMessage(content)
      
      // Add optimistic update
      setOptimisticMessages(prev => [...prev, sentMessage!])
      
      // If there's a file selected, upload it
      if (selectedFile && sentMessage) {
        const updatedMessage = await handleFileUpload(selectedFile, sentMessage.id)
        // Update the messages list with the new message containing the attachment
        setOptimisticMessages(prev => 
          prev.map(m => m.id === sentMessage!.id ? updatedMessage : m)
        )
      }

      // Clear the form
      form.reset()
      setSelectedFile(null)
      
      // Scroll to bottom
      scrollToBottom()
    } catch (error) {
      console.error('Error sending message:', error)
      // Remove optimistic message on error
      if (sentMessage) {
        setOptimisticMessages(prev => 
          prev.filter(m => m.id !== sentMessage!.id)
        )
      }
    }
  }

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file)
  }

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
      <div className="flex-none p-4 border-b">
        <SearchBar
          onSearch={setSearchQuery}
          className="max-w-md mx-auto"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4" ref={scrollContainerRef}>
        {/* Load More Button */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center mb-4">
            <button
              onClick={() => loadMore()}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white hover:bg-indigo-50 rounded-md border border-indigo-300"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4">
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

            return (
              <MessageBubble
                key={message.id}
                message={message}
                user={messageUser}
                isOwnMessage={message.user_id === user?.id}
                onEdit={async (content) => {
                  await updateMessage(message.id, content)
                }}
                onDeleteAttachment={async (attachmentId) => {
                  try {
                    const attachment = message.attachments?.find(a => a.id === attachmentId)
                    if (!attachment) return

                    // Delete from storage
                    await supabase.storage
                      .from('message-attachments')
                      .remove([attachment.file_path])

                    // Update message attachments
                    const newAttachments = message.attachments?.filter(a => a.id !== attachmentId) || []
                    const { error } = await supabase
                      .rpc(
                        chatType === 'dm' ? 'update_dm_with_attachment' : 'update_message_with_attachment',
                        {
                          p_message_id: message.id,
                          p_attachments: newAttachments
                        }
                      )

                    if (error) throw error

                    // Update optimistic state
                    setOptimisticMessages(prev =>
                      prev.map(m => m.id === message.id
                        ? { ...m, attachments: newAttachments }
                        : m
                      )
                    )
                  } catch (error) {
                    console.error('Failed to delete attachment:', error)
                  }
                }}
              />
            )
          })}
        </div>

        {/* End of Messages Marker */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex-none p-4 border-t bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          isUploading={isUploading}
        />
      </div>
    </div>
  )
} 