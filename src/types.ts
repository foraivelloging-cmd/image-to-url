export interface UploadedFile {
  id: string;
  originalFile: File;
  originalSize: number;
  compressedBlob?: Blob;
  compressedSize?: number;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  url?: string;
  previewUrl: string;
  error?: string;
  originalUrl?: string;
}
