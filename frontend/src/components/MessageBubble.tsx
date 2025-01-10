import { User, DirectMessageWithUser, MessageWithUser, MessageAttachment } from '../types/schema'
import { useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'

interface MessageBubbleProps {
  message: DirectMessageWithUser | MessageWithUser
  user: User
  isOwnMessage: boolean
  onEdit?: (content: string) => Promise<void>
  onDeleteAttachment?: (attachmentId: string) => Promise<void>
}

export function MessageBubble({ 
  message, 
  user, 
  isOwnMessage,
  onEdit,
  onDeleteAttachment
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  // Get the correct content based on message type
  const messageContent = 'content' in message ? message.content : message.message

  const handleEdit = () => {
    setEditContent(messageContent || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      if (onEdit) {
      await onEdit(editContent)
      }
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to edit message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (onDeleteAttachment) {
      try {
        await onDeleteAttachment(attachmentId)
      } catch (error) {
        console.error('Failed to delete attachment:', error)
      }
    }
  }

  const formatTimestamp = (message: DirectMessageWithUser | MessageWithUser): string => {
    try {
      const timestamp = 'created_at' in message ? message.created_at : message.inserted_at
      if (!timestamp) return 'Just now'
      
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return 'Just now'
      
      const now = new Date()
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      
      if (diffInMinutes < 1) return 'Just now'
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`
      
      // If it's today, show time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }
      
      // If it's yesterday, show "Yesterday at time"
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      }
      
      // Otherwise show date and time
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return 'Just now'
    }
  }

  return (
    <div className={`flex items-start space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white uppercase">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.username || ''} className="w-10 h-10 rounded-full" />
        ) : (
          <span>{(user.username || 'U')[0]}</span>
        )}
      </div>
      <div className={`flex flex-col space-y-1 max-w-lg ${isOwnMessage ? 'items-end' : ''}`}>
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-900">{user.username || 'Unknown User'}</span>
          <span className="text-sm text-gray-500">
            {formatTimestamp(message)}
          </span>
        </div>
          {isEditing ? (
          <div className="w-full">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            <div className="flex justify-end space-x-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
          <div className="group relative">
            <div
              className={`rounded-lg px-4 py-2 ${
                isOwnMessage
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{messageContent}</div>
              {message.attachments?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.attachments.map((attachment: MessageAttachment) => (
                    <div key={attachment.id} className="flex items-center justify-between">
                      <a
                        href={attachment.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline hover:text-indigo-500"
                      >
                        {attachment.filename}
                      </a>
                      {isOwnMessage && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
            </div>
          )}
            </div>
            {isOwnMessage && !isEditing && onEdit && (
              <button
                onClick={handleEdit}
                className="absolute top-2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-700"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
        </div>
        )}
      </div>
    </div>
  )
} 