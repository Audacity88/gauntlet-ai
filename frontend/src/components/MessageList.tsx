import { useEffect, useRef, useState, useMemo } from 'react'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { MessageBubble } from './MessageBubble'
import { FileUpload } from './FileUpload'
import { useFileUpload } from '../hooks/useFileUpload'
import { useAuth } from '../hooks/useAuth'
import { Message, DirectMessage, DirectMessageWithUser, MessageWithUser, User, MessageAttachment } from '../types/schema'
import { Paperclip } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { SearchBar } from './SearchBar'
import { MessageInput } from './MessageInput'

interface MessageListProps {
  channelId: string  // Now always UUID
  chatType?: 'channel' | 'dm'
  markChannelAsRead?: (channelId: string) => Promise<void>
}

type AnyMessage = MessageWithUser | DirectMessageWithUser;

// Helper to create an optimistic message
const createOptimisticMessage = (
  content: string, 
  currentUser: User, 
  channelId: string, 
  chatType: 'channel' | 'dm'
): AnyMessage => {
  const now = new Date().toISOString()
  const tempId = `temp-${Date.now()}`

  const base = {
    id: tempId,
    channel_id: channelId,
    user_id: currentUser.id,
    profile_id: currentUser.id,
    user: currentUser,
    profile: currentUser,
    created_at: now,
    updated_at: now,
    attachments: [] as MessageAttachment[]
  }

  if (chatType === 'dm') {
    return {
      ...base,
      content,
    } as DirectMessageWithUser
  }

  return {
    ...base,
    message: content,
    content: undefined,
    inserted_at: now,
  } as MessageWithUser
}

export function MessageList({ 
  channelId, 
  chatType = 'channel',
  markChannelAsRead 
}: MessageListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
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

  const [optimisticMessages, setOptimisticMessages] = useState<AnyMessage[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const { uploadFile } = useFileUpload({ chatType: chatType || 'channel' })
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

  // Memoize the combined messages to prevent infinite updates
  const messages = useMemo(() => {
    // Transform server messages
    const transformedMessages = serverMessages.map(msg => {
      try {
        // Handle malformed message objects that might be spread incorrectly
        const baseMsg = typeof msg === 'object' && msg !== null ? 
          (Object.prototype.hasOwnProperty.call(msg, '0') ? (msg as Record<string, any>)[0] : msg) : msg

        // Ensure we have a valid message object
        if (!baseMsg || typeof baseMsg !== 'object') {
          console.warn('Invalid message object:', msg)
          return null
        }

        // Extract user data first to ensure it exists
        const userProfile = baseMsg.profile || baseMsg.user
        if (!userProfile || typeof userProfile !== 'object') {
          console.warn('Missing or invalid user profile:', baseMsg)
          return null
        }

        const userId = userProfile.id || baseMsg.user_id || baseMsg.profile_id
        if (!userId) {
          console.warn('Missing user ID in message:', baseMsg)
          return null
        }

        // Get the message date based on chat type
        let messageDate = null
        if (chatType === 'dm') {
          messageDate = baseMsg.created_at
        } else {
          messageDate = (baseMsg as MessageWithUser).inserted_at || baseMsg.created_at
        }

        // Ensure we have a valid date
        if (!messageDate) {
          messageDate = new Date().toISOString()
        } else {
          try {
            // Validate the date
            const testDate = new Date(messageDate)
            if (isNaN(testDate.getTime())) {
              messageDate = new Date().toISOString()
            } else {
              messageDate = testDate.toISOString()
            }
          } catch {
            messageDate = new Date().toISOString()
          }
        }

        // Handle attachments
        let attachments: MessageAttachment[] = []
        if (baseMsg.attachments) {
          try {
            if (typeof baseMsg.attachments === 'string') {
              attachments = JSON.parse(baseMsg.attachments)
            } else if (Array.isArray(baseMsg.attachments)) {
              attachments = baseMsg.attachments
            }
            // Validate each attachment
            attachments = attachments.filter((att: any): att is MessageAttachment => 
              att && typeof att === 'object' && 
              typeof att.id === 'string' && 
              typeof att.file_path === 'string'
            )
          } catch (e) {
            console.warn('Failed to parse attachments:', e)
            attachments = []
          }
        }

        // Create base message structure
        const baseMessage = {
          id: baseMsg.id || `temp-${Date.now()}`,
          user_id: userId,
          profile_id: userId,
          profile: userProfile,
          user: userProfile,
          channel_id: baseMsg.channel_id,
          attachments,
          created_at: messageDate,
          updated_at: baseMsg.updated_at ? new Date(baseMsg.updated_at).toISOString() : messageDate
        }

        // Create the appropriate message type
        if (chatType === 'dm') {
          return {
            ...baseMessage,
            content: baseMsg.content || ' ',
          } as DirectMessageWithUser
        }

        return {
          ...baseMessage,
          message: baseMsg.content || (baseMsg as MessageWithUser).message || ' ',
          inserted_at: messageDate,
        } as MessageWithUser

      } catch (error) {
        console.error('Error transforming message:', error, msg)
        return null
      }
    })
    .filter((msg): msg is AnyMessage => 
      msg !== null && 
      typeof msg.user_id === 'string' && 
      typeof msg.created_at === 'string' && 
      !isNaN(new Date(msg.created_at).getTime())
    )

    // Filter optimistic messages that haven't been synced yet
    const pendingOptimisticMessages = optimisticMessages.filter(optMsg => {
      return !transformedMessages.some(m => 
        m.id === optMsg.id || 
        (m.user_id === optMsg.user_id && 
         ((chatType === 'dm' ? m.content : (m as MessageWithUser).message) === 
          (chatType === 'dm' ? optMsg.content : (optMsg as MessageWithUser).message)) &&
         Math.abs(new Date(m.created_at).getTime() - new Date(optMsg.created_at).getTime()) < 5000)
      )
    })

    return [...transformedMessages, ...pendingOptimisticMessages]
  }, [serverMessages, optimisticMessages, chatType])

  // Clean up old optimistic messages
  useEffect(() => {
    const serverMessageIds = new Set(serverMessages.map(m => m.id))
    setOptimisticMessages(prev => 
      prev.filter(optMsg => {
        // Keep message if it's not in server messages
        return !serverMessageIds.has(optMsg.id)
      })
    )
  }, [serverMessages])

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
    // Only throw error if both content and file are missing
    if (!content.trim() && !selectedFile) {
      throw new Error('Message must have either text content or an attachment')
    }

    try {
      // First verify channel membership and get profile_id
      const { data: memberData, error: memberError } = await supabase
        .from(chatType === 'dm' ? 'direct_message_members' : 'channel_members')
        .select('profile_id, id')
        .eq('channel_id', channelId)
        .eq('user_id', user.id)
        .single()

      if (memberError) {
        console.error('Error verifying channel membership:', memberError)
        throw new Error('Not a member of this channel')
      }

      if (!memberData?.profile_id) {
        console.error('No profile ID found:', memberData)
        throw new Error('No profile ID found for user in this channel')
      }

    const table = chatType === 'dm' ? 'direct_messages' : 'messages'
      const now = new Date().toISOString()

      // Create the message data with the correct structure for the chat type
    const messageData = {
        content: content.trim() || ' ', // Use space if empty to ensure valid content
      channel_id: channelId,
      user_id: user.id,
        profile_id: memberData.profile_id,
        created_at: now,
        updated_at: now,
        ...(chatType === 'channel' ? { inserted_at: now } : {})
      }

      console.log('Sending message with data:', messageData)

      // Insert the message and get back the full record with profile data
      const { data: messageResponse, error: insertError } = await supabase
      .from(table)
      .insert(messageData)
        .select(`
          *,
          profile:profiles(*)
        `)
      .single()

      if (insertError) {
        console.error('Error inserting message:', insertError)
        throw insertError
      }

      if (!messageResponse || !messageResponse.profile) {
        console.error('No message or profile data returned:', messageResponse)
        throw new Error('Failed to create message')
      }

      return messageResponse
    } catch (error) {
      console.error('Error in handleSendMessage:', error)
      throw error instanceof Error ? error : new Error('Failed to send message')
    }
  }

  // Update the file upload logic
  const handleFileUpload = async (file: File, messageId: string) => {
    try {
      console.log('Starting file upload for message:', messageId)
      
      // Upload file to storage - using message-attachments bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(`${messageId}/${file.name}`, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        throw uploadError
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(`${messageId}/${file.name}`)

      // Create attachment object
      const now = new Date().toISOString()
      const newAttachment: MessageAttachment = {
        id: crypto.randomUUID(),
        message_id: messageId,
        filename: file.name,
        file_path: `${messageId}/${file.name}`,
        content_type: file.type,
        size: file.size,
        url: publicUrl,
        created_at: now,
        updated_at: now
      }

      // Get existing message
      const { data: existingMessage, error: messageError } = await supabase
        .from(chatType === 'dm' ? 'direct_messages' : 'messages')
        .select('*, profile:profiles(*)')
        .eq('id', messageId)
        .single()

      if (messageError) throw messageError

      // Update message with attachment
      const newAttachments = [...(existingMessage.attachments || []), newAttachment]
      
      // First update optimistically
      const optimisticMessage = {
        ...existingMessage,
        attachments: newAttachments,
        updated_at: now
      }
      setOptimisticMessages(prev => 
        prev.map(m => m.id === messageId ? optimisticMessage : m)
      )

      // Then update in database
      const { data: updatedMessage, error: updateError } = await supabase
        .from(chatType === 'dm' ? 'direct_messages' : 'messages')
        .update({
          attachments: newAttachments,
          updated_at: now
        })
        .eq('id', messageId)
        .select('*, profile:profiles(*)')
        .single()

      if (updateError) throw updateError

      return {
        ...updatedMessage,
        attachments: newAttachments,
        profile: existingMessage.profile,
        user: existingMessage.profile
      }
    } catch (error) {
      console.error('Error in handleFileUpload:', error)
      throw error
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
                    // Ensure attachments is an array and parse if needed
                    let currentAttachments = []
                    if (message.attachments) {
                      try {
                        currentAttachments = typeof message.attachments === 'string'
                          ? JSON.parse(message.attachments)
                          : message.attachments
                      } catch (e) {
                        console.warn('Failed to parse attachments:', e)
                      }
                    }

                    // Ensure currentAttachments is an array
                    if (!Array.isArray(currentAttachments)) {
                      currentAttachments = []
                    }

                    const attachment = currentAttachments.find(a => a.id === attachmentId)
                    if (!attachment) return

                    // Delete from storage
                    await supabase.storage
                      .from('message-attachments')
                      .remove([attachment.file_path])

                    // Update message attachments
                    const newAttachments = currentAttachments.filter(a => a.id !== attachmentId)
                    const { error } = await supabase
                      .rpc(
                        chatType === 'dm' ? 'update_dm_with_attachment' : 'update_message_with_attachment',
                        {
                          p_message_id: message.id,
                          p_attachments: JSON.stringify(newAttachments) // Ensure it's a valid JSON string
                        }
                      )

                    if (error) {
                      console.error('Failed to update message:', error)
                      throw error
                    }

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
      <div className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <MessageInput
            onSubmit={async (content) => {
              if (!user) throw new Error('No user found')
              if (!content.trim() && !selectedFile) return

              let tempMessageId = `temp-${Date.now()}`
              try {
                setIsUploading(true)

                // Create optimistic message
                const optimisticMessage = createOptimisticMessage(content, user, channelId, chatType)
                tempMessageId = optimisticMessage.id // Store the ID for error handling
                setOptimisticMessages(prev => [...prev, optimisticMessage])

                // Send the actual message with retry logic
                let sentMessage = null
                let retryCount = 0
                const maxRetries = 3

                while (!sentMessage && retryCount < maxRetries) {
                  try {
                    sentMessage = await handleSendMessage(content)
                    break
                  } catch (error) {
                    retryCount++
                    if (retryCount === maxRetries) throw error
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)) // Exponential backoff
                  }
                }

                if (!sentMessage) throw new Error('Failed to send message after retries')

                // If there's a file, upload it
                if (selectedFile && sentMessage) {
                  const messageWithAttachment = await handleFileUpload(selectedFile, sentMessage.id)
                  // Update the message in the optimistic state with the attachment
                  setOptimisticMessages(prev =>
                    prev.map(m => m.id === tempMessageId ? messageWithAttachment : m)
                  )
                  setSelectedFile(null)
                }
                // Don't remove the optimistic message here - let the realtime update handle it

                scrollToBottom()
              } catch (error) {
                console.error('Error sending message:', error)
                // Remove optimistic message on error
                setOptimisticMessages(prev => 
                  prev.filter(m => m.id !== tempMessageId)
                )
              } finally {
                setIsUploading(false)
              }
            }}
            onFileSelect={setSelectedFile}
                  selectedFile={selectedFile}
                  isUploading={isUploading}
                />
        </div>
      </div>
    </div>
  )
} 