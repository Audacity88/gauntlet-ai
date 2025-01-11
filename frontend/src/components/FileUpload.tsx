import { memo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useFileUpload } from '../hooks/useFileUpload';
import { UploadResult, FileValidationError } from '../utils/FileManager';

interface FileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: Error) => void;
  className?: string;
}

export const FileUpload = memo(function FileUpload({
  onUploadComplete,
  onUploadError,
  className = ''
}: FileUploadProps) {
  const {
    uploadFile,
    isUploading,
    uploadProgress
  } = useFileUpload({
    onUploadComplete,
    onUploadError
  });

  const onDrop = async (acceptedFiles: File[]) => {
    try {
      const file = acceptedFiles[0];
      if (!file) return;

      await uploadFile(file);
    } catch (err) {
      if (err instanceof FileValidationError) {
        onUploadError?.(err);
      } else {
        const error = err instanceof Error ? err : new Error('Upload failed');
        onUploadError?.(error);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false
  });

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={`
          relative p-6 border-2 border-dashed rounded-lg
          transition-colors duration-200 cursor-pointer
          ${isDragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-indigo-500 rounded transition-all duration-200"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
            <p className="text-sm text-center text-gray-500">
              Uploading... {Math.round(uploadProgress.progress)}%
            </p>
          </div>
        ) : isDragActive ? (
          <p className="text-center text-indigo-600">
            Drop the file here...
          </p>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-gray-600">
              Drag and drop a file here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supported files: Images, PDFs, Text files (max 10MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}); 