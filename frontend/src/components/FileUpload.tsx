import { useState, useRef } from 'react'
import { Upload, X } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void | Promise<void>
  onRemove: () => void
  selectedFile?: File | null
  isUploading?: boolean
}

export function FileUpload({ onFileSelect, onRemove, selectedFile, isUploading = false }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="w-full">
      {selectedFile ? (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
          </div>
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <button
              onClick={onRemove}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />
          <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">
            Drop a file here, or <span className="text-blue-500">click to select</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Max file size: 10MB
          </p>
        </div>
      )}
    </div>
  )
} 