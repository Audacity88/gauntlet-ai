import { FileIcon, Trash2 } from 'lucide-react'

interface FileAttachmentProps {
  filename: string
  fileSize: number
  contentType: string
  onDelete?: () => void | Promise<void>
  isOwner?: boolean
}

export function FileAttachment({ filename, fileSize, contentType, onDelete, isOwner = false }: FileAttachmentProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const isImage = contentType.startsWith('image/')
  const isPDF = contentType === 'application/pdf'
  const isDoc = contentType.includes('word') || contentType.includes('msword')

  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg max-w-sm">
      <div className="flex-shrink-0">
        {isImage ? (
          <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
            <img
              src={`/api/files/${filename}`}
              alt={filename}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <FileIcon className={`w-10 h-10 ${
            isPDF ? 'text-red-500' :
            isDoc ? 'text-blue-500' :
            'text-gray-500'
          }`} />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={filename}>
          {filename}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(fileSize)}
        </p>
      </div>

      {isOwner && onDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          aria-label="Delete file"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
} 