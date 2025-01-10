import { useState } from 'react'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'  // FastAPI default port

interface UseFileUploadOptions {
  onSuccess?: (url: string) => void
  onError?: (error: Error) => void
}

interface FileUploadResponse {
  id: string  // UUID
  message_id: string  // UUID
  filename: string
  file_path: string
  file_size: number
  content_type: string
  created_at: string
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const uploadFile = async (file: File, messageId: string): Promise<FileUploadResponse> => {
    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post<FileUploadResponse>(`${API_BASE_URL}/files/upload/${messageId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      })

      options.onSuccess?.(response.data.file_path)
      return response.data
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to upload file')
      setError(error)
      options.onError?.(error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  const deleteFile = async (attachmentId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/files/${attachmentId}`, {
        withCredentials: true,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete file')
      throw error
    }
  }

  return {
    uploadFile,
    deleteFile,
    isUploading,
    error,
  }
} 