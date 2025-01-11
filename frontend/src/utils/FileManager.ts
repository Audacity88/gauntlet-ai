import { supabase } from '../lib/supabaseClient';

export interface FileConfig {
  maxSize: number;
  allowedTypes: string[];
  maxFiles: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  progress: number;
}

export interface UploadResult {
  path: string;
  url: string;
  size: number;
  type: string;
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

export class FileManager {
  private config: FileConfig;

  constructor(config?: Partial<FileConfig>) {
    this.config = {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['image/*', 'application/pdf', 'text/*'],
      maxFiles: 5,
      ...config
    };
  }

  async uploadFile(
    file: File,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Validate file
    this.validateFile(file);

    // Create unique filename
    const timestamp = new Date().getTime();
    const filename = `${timestamp}-${file.name}`;
    const fullPath = `${path}/${filename}`;

    try {
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fullPath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: ({ loaded, total }) => {
            if (onProgress) {
              const progress = (loaded / total) * 100;
              onProgress({ loaded, total, progress });
            }
          }
        });

      if (error) throw error;
      if (!data) throw new Error('Upload failed');

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(data.path);

      return {
        path: data.path,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      throw error;
    }
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from('message-attachments')
        .remove([path]);

      if (error) throw error;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Delete failed');
      throw error;
    }
  }

  async getFileUrl(path: string): Promise<string> {
    const { data } = supabase.storage
      .from('message-attachments')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  private validateFile(file: File): void {
    // Check file size
    if (file.size > this.config.maxSize) {
      throw new FileValidationError(
        `File size exceeds ${this.formatSize(this.config.maxSize)}`
      );
    }

    // Check file type
    const isAllowedType = this.config.allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const baseType = type.split('/')[0];
        return file.type.startsWith(baseType);
      }
      return file.type === type;
    });

    if (!isAllowedType) {
      throw new FileValidationError(
        `File type ${file.type} is not allowed. Allowed types: ${this.config.allowedTypes.join(', ')}`
      );
    }
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Create a singleton instance with default config
let fileManager: FileManager | null = null;

export function getFileManager(config?: Partial<FileConfig>): FileManager {
  if (!fileManager || config) {
    fileManager = new FileManager(config);
  }
  return fileManager;
} 