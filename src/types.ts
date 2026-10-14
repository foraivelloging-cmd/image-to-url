export interface UploadedFile {
  id: string;
  originalFile: File;
  customName?: string;
  originalSize: number;
  compressedBlob?: Blob;
  compressedSize?: number;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  url?: string;
  previewUrl: string;
  error?: string;
  originalUrl?: string;
}
