import { useState, useCallback } from 'react';
import { getFileManager, UploadProgress, UploadResult, FileValidationError } from '../utils/FileManager';
import { useAuth } from './useAuth';

interface UseFileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: Error) => void;
  onUploadProgress?: (progress: UploadProgress) => void;
}

export function useFileUpload({
  onUploadComplete,
  onUploadError,
  onUploadProgress
}: UseFileUploadProps = {}) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    progress: 0
  });

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      throw new Error('User must be authenticated to upload files');
    }

    setIsUploading(true);
    const fileManager = getFileManager();

    try {
      // Create path based on user and timestamp
      const timestamp = new Date().getTime();
      const path = `uploads/${user.id}/${timestamp}`;

      // Upload file
      const result = await fileManager.uploadFile(file, path, (progress) => {
        setUploadProgress(progress);
        onUploadProgress?.(progress);
      });

      onUploadComplete?.(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      onUploadError?.(error);
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress({ loaded: 0, total: 0, progress: 0 });
    }
  }, [user, onUploadComplete, onUploadError, onUploadProgress]);

  const deleteFile = useCallback(async (path: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete files');
    }

    const fileManager = getFileManager();
    await fileManager.deleteFile(path);
  }, [user]);

  return {
    uploadFile,
    deleteFile,
    isUploading,
    uploadProgress
  };
} 