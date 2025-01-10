import { useState, useRef } from 'react'
import { Paperclip, Send } from 'lucide-react'

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>
  onFileSelect: (file: File) => void
  selectedFile: File | null
  isUploading: boolean
}

export function MessageInput({
  onSendMessage,
  onFileSelect,
  selectedFile,
  isUploading
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedMessage = message.trim()
    
    if (!trimmedMessage && !selectedFile) return
    
    try {
      await onSendMessage(trimmedMessage)
      setMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          disabled={isUploading}
        />
        {selectedFile && (
          <div className="absolute -top-8 left-0 bg-gray-100 px-2 py-1 rounded text-sm text-gray-600 flex items-center">
            <span className="truncate max-w-xs">{selectedFile.name}</span>
            <button
              type="button"
              onClick={() => onFileSelect(null as any)}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleFileClick}
        className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        disabled={isUploading}
      >
        <Paperclip className="w-5 h-5" />
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx,.txt"
        />
      </button>

      <button
        type="submit"
        className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isUploading || (!message.trim() && !selectedFile)}
      >
        <Send className="w-5 h-5" />
      </button>
    </form>
  )
} 