import { useEffect, useRef } from 'react'
import { useRealtimeMessages } from '../hooks/useRealtimeMessages'
import { MessageBubble } from './MessageBubble'
import { useAuth } from '../hooks/useAuth'

interface MessageListProps {
  channelId: string
  chatType?: 'channel' | 'dm'
}

export function MessageList({ channelId, chatType = 'channel' }: MessageListProps) {
  const {
    messages,
    isLoading,
    error,
    hasMore,
    loadMore,
    sendMessage,
    updateMessage,
    addReaction
  } = useRealtimeMessages({ channelId, chatType })

  const { user } = useAuth()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
      {/* Load More Button */}
      {hasMore && (
        <div className="p-4 text-center border-b">
          <button
            onClick={() => loadMore()}
            disabled={isLoading}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 space-y-6 py-6">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.user_id === user?.id}
              onReaction={(emoji) => addReaction(message.id, emoji)}
              onEdit={(content) => updateMessage(message.id, content)}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const input = form.elements.namedItem('message') as HTMLInputElement
              const content = input.value.trim()

              if (content) {
                try {
                  await sendMessage(content)
                  input.value = ''
                } catch (err) {
                  console.error('Failed to send message:', err)
                  alert('Failed to send message. Please try again.')
                }
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              name="message"
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
} 