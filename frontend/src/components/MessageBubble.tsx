import { useState, useEffect } from 'react'
import { Message } from '../hooks/useRealtimeMessages'
import { EmojiPicker } from './EmojiPicker'
import { supabase } from '../lib/supabaseClient'

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  onReaction: (emoji: string) => Promise<void>
  onEdit: (content: string) => Promise<void>
}

export function MessageBubble({ 
  message, 
  isOwnMessage,
  onReaction,
  onEdit
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUsername() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', message.user_id)
          .single()

        if (error) throw error
        setUsername(data.username || 'Unknown User')
      } catch (err) {
        console.error('Error fetching username:', err)
        setUsername('Unknown User')
      }
    }

    fetchUsername()
  }, [message.user_id])

  // Format message content with markdown-like syntax
  const formatContent = (content: string) => {
    return content
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // Bold
      .replace(/_([^_]+)_/g, '<em>$1</em>') // Italic
      .replace(/`([^`]+)`/g, '<code>$1</code>') // Code
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">$1</a>') // Links
  }

  const handleEdit = async () => {
    if (editContent.trim() !== message.content) {
      await onEdit(editContent)
    }
    setIsEditing(false)
  }

  return (
    <div className={`group flex items-start gap-4 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />

      <div className={`flex-1 max-w-2xl ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Message header */}
        <div className={`flex items-center gap-2 mb-1 w-4/5 ${isOwnMessage ? 'ml-auto' : ''}`}>
          <span className="font-medium text-black">{username || 'Loading...'}</span>
          <span className="text-sm text-gray-500">
            {new Date(message.created_at).toLocaleTimeString()}
          </span>
        </div>

        {/* Message content */}
        <div className={`relative rounded-lg p-4 w-4/5 ${
          isOwnMessage 
            ? 'bg-blue-400 text-white ml-auto' 
            : 'bg-indigo-300 text-black'
        }`}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              dangerouslySetInnerHTML={{ 
                __html: formatContent(message.content) 
              }}
              className="break-words"
            />
          )}

          {/* Message actions */}
          <div className={`absolute bottom-full mb-1 ${
            isOwnMessage ? 'right-0' : 'left-0'
          } opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
            <div className="flex items-center gap-1 bg-white rounded-full shadow px-2 py-1">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 hover:bg-gray-100 rounded-full"
                title="Add reaction"
              >
                😀
              </button>
              {isOwnMessage && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                  title="Edit message"
                >
                  ✏️
                </button>
              )}
            </div>
            {showEmojiPicker && (
              <div 
                className={`absolute top-0 ${
                  isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'
                }`}
              >
                <EmojiPicker
                  onSelect={(emoji) => {
                    onReaction(emoji)
                    setShowEmojiPicker(false)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.message_reactions && message.message_reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-2 ${isOwnMessage ? 'justify-end' : ''}`}>
            {Object.entries(
              message.message_reactions.reduce((acc, reaction) => {
                acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1
                return acc
              }, {} as Record<string, number>)
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-gray-500">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Attachments */}
        {message.message_attachments && message.message_attachments.length > 0 && (
          <div className={`mt-2 space-y-1 ${isOwnMessage ? 'text-right' : ''}`}>
            {message.message_attachments.map(attachment => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-700"
              >
                📎 {attachment.file_name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 