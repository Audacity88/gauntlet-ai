import { FormEvent, useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { FileUpload } from './FileUpload'

interface MessageInputProps {
  onSubmit: (content: string) => Promise<void>
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  isUploading: boolean
}

export function MessageInput({ 
  onSubmit, 
  onFileSelect, 
  selectedFile, 
  isUploading 
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !selectedFile) return
    
    setError(null)
    try {
      await onSubmit(content)
      setContent('')
    } catch (error) {
      console.error('Error sending message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="px-2 text-red-500 text-sm">
          {error}
        </div>
      )}
      
      {selectedFile && (
        <div className="px-2">
          <FileUpload
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            onRemove={() => onFileSelect(null)}
            isUploading={isUploading}
          />
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          disabled={isUploading}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-800 hover:text-white rounded-full transition-colors"
            disabled={isUploading}
          >
            <Paperclip className="w-5 h-5" />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  onFileSelect(file)
                  if (error) setError(null)
                }
              }}
              accept="image/*,application/pdf,.doc,.docx,.txt"
            />
          </button>
          <button
            type="submit"
            disabled={isUploading || (!content.trim() && !selectedFile)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isUploading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  )
} 