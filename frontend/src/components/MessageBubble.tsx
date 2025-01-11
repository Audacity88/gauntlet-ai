import { User, DirectMessageWithUser, MessageWithUser, MessageAttachment } from '../types/schema'
import { useState, useEffect } from 'react'
import { Trash2, Pencil, FileIcon, Image as ImageIcon, Loader2, Check, X } from 'lucide-react'

type AnyMessage = MessageWithUser | DirectMessageWithUser;

interface MessageBubbleProps {
  message: AnyMessage
  user: User
  isOwnMessage: boolean
  onEdit?: (content: string) => Promise<void>
  onDeleteAttachment?: (attachmentId: string) => Promise<void>
}

export function MessageBubble({ message, user, isOwnMessage, onEdit, onDeleteAttachment }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(message.content || message.message || '')
  const [imageError, setImageError] = useState<Record<string, boolean>>({})
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({})

  const messageContent = 'message' in message ? message.message : message.content
  const timestamp = 'inserted_at' in message ? message.inserted_at : message.created_at

  // Update editedContent when message changes
  useEffect(() => {
    setEditedContent(message.content || message.message || '')
  }, [message])

  useEffect(() => {
    // Reset loading and error states when message changes
    setImageLoading({})
    setImageError({})
  }, [message])

  const handleEdit = async () => {
    if (!onEdit || !editedContent.trim()) return
    try {
      await onEdit(editedContent)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to edit message:', error)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImageFile = (filename: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
    return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext))
  }

  const handleImageError = (attachmentId: string) => {
    setImageError(prev => ({ ...prev, [attachmentId]: true }))
    setImageLoading(prev => ({ ...prev, [attachmentId]: false }))
  }

  const handleImageLoad = (attachmentId: string) => {
    setImageLoading(prev => ({ ...prev, [attachmentId]: false }))
  }

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwnMessage ? 'bg-blue-500 text-white' : 'bg-gray-100 text-black'} rounded-lg p-3 group`}>
        {!isOwnMessage && (
          <div className="text-sm font-medium mb-1">
            {user.username || 'Unknown User'}
          </div>
        )}
        
        <div className="relative">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-inherit"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleEdit()
                  } else if (e.key === 'Escape') {
                    setIsEditing(false)
                  }
                }}
              />
              <div className="flex gap-1">
                <button
                  onClick={handleEdit}
                  className="p-1 bg-black/10 hover:bg-transparent rounded transition-colors"
                  aria-label="Save edit"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 bg-black/10 hover:bg-transparent rounded transition-colors"
                  aria-label="Cancel edit"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="break-words">{messageContent}</div>
              {isOwnMessage && onEdit && !message.attachments?.length && (
                <button
                  onClick={() => {
                    setEditedContent(messageContent)
                    setIsEditing(true)
                  }}
                  className="absolute right-1 top-0 p-1.5 rounded-full opacity-100 hover:opacity-30 transition-opacity bg-black/10 hover:bg-transparent"
                  aria-label="Edit message"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
            
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => {
              const isImage = isImageFile(attachment.filename)
              const isLoading = imageLoading[attachment.id]
              const hasError = imageError[attachment.id]

              return (
                <div key={attachment.id} className="group relative">
                  {isImage && !hasError ? (
                    <div className="relative min-h-[100px] bg-gray-100 rounded-lg overflow-hidden">
                      {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      )}
                      <img
                        src={attachment.url}
                        alt={attachment.filename}
                        className={`max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        onClick={() => window.open(attachment.url, '_blank')}
                        onError={() => handleImageError(attachment.id)}
                        onLoad={() => handleImageLoad(attachment.id)}
                        onLoadStart={() => setImageLoading(prev => ({ ...prev, [attachment.id]: true }))}
                      />
                      {isOwnMessage && onDeleteAttachment && (
                        <button
                          onClick={() => onDeleteAttachment(attachment.id)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group-hover:bg-opacity-50 transition-colors rounded p-1">
                      {hasError ? <ImageIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        {attachment.filename} ({formatFileSize(attachment.size)})
                      </a>
                      {isOwnMessage && onDeleteAttachment && (
                        <button
                          onClick={() => onDeleteAttachment(attachment.id)}
                          className="text-red-500 hover:text-red-700"
                          aria-label="Delete attachment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        
        <div className="text-xs mt-1 opacity-70">
          {formatTimestamp(timestamp)}
        </div>
      </div>
    </div>
  )
} 