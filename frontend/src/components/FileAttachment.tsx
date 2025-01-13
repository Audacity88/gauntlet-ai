import { FileIcon, Trash2, Download } from 'lucide-react'

interface FileAttachmentProps {
  filename: string
  fileSize: number
  contentType: string
  onDelete?: () => void | Promise<void>
  isOwner?: boolean
  url?: string
  filePath?: string
}

export function FileAttachment({ 
  filename, 
  fileSize, 
  contentType, 
  onDelete, 
  isOwner = false,
  url,
  filePath
}: FileAttachmentProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const isImage = contentType?.startsWith('image/') || false
  const isPDF = contentType === 'application/pdf'
  const isDoc = contentType?.includes('word') || contentType?.includes('msword') || false
  const downloadUrl = url || filePath

  if (!downloadUrl) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg max-w-sm hover:bg-gray-100 transition-colors group">
      <div className="flex-shrink-0">
        {isImage ? (
          <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden">
            <img
              src={downloadUrl}
              alt={filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <FileIcon className={`w-12 h-12 ${
            isPDF ? 'text-red-500' :
            isDoc ? 'text-blue-500' :
            'text-gray-500'
          }`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <a
            href={downloadUrl}
            download={filename}
            className="text-sm font-medium text-gray-900 truncate hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {filename}
          </a>
          {isOwner && onDelete && (
            <button
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete attachment"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {fileSize && (
          <p className="text-xs text-gray-500">
            {formatFileSize(fileSize)}
          </p>
        )}
      </div>
    </div>
  );
} 