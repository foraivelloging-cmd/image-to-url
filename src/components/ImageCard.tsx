import React from 'react';
import { RefreshCw, X, Copy, Download, Loader2, CheckCircle2, AlertCircle, QrCode, UploadCloud } from 'lucide-react';
import { UploadedFile } from '../types';

interface ImageCardProps {
  upload: UploadedFile;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (upload: UploadedFile) => void;
  onShowQR: (url: string) => void;
  onForceUpload: (id: string) => void;
  formatBytes: (bytes: number, decimals?: number) => string;
}

export const ImageCard: React.FC<ImageCardProps> = ({ upload, onReplace, onDelete, onDownload, onShowQR, onForceUpload, formatBytes }) => {
  return (
    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex gap-4 items-center">
      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat border border-slate-700">
        <img src={upload.previewUrl} className="w-full h-full object-contain" alt="preview" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs font-medium text-slate-300 truncate pr-2">{upload.originalFile.name}</p>
          <div className="flex items-center gap-3 shrink-0">
            {upload.status === 'success' && !upload.url && (
              <button 
                onClick={() => onForceUpload(upload.id)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Upload to Server"
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            )}
            {upload.originalUrl && upload.status === 'success' && upload.url && (
              <button 
                onClick={() => onForceUpload(upload.id)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Re-upload to Server"
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => onReplace(upload.id)}
              className="text-slate-400 hover:text-blue-400 transition-colors"
              title="Replace Image"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(upload.id)}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="Remove Image"
            >
              <X className="w-4 h-4" />
            </button>
            {upload.status === 'success' && upload.url && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(upload.url!);
                }}
                className="text-slate-400 hover:text-emerald-400 transition-colors"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            {(upload.status === 'success' || upload.status === 'error') && (
              <button 
                onClick={() => onDownload(upload)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <span className="shrink-0 border-l border-slate-700 pl-3 ml-1">
              {upload.status === 'pending' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
              {upload.status === 'compressing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
              {upload.status === 'uploading' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
              {upload.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {upload.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>{formatBytes(upload.originalSize)}</span>
          {upload.compressedSize && upload.compressedSize < upload.originalSize && (
            <>
              <span className="text-slate-700">→</span>
              <span className="text-emerald-400 font-medium">{formatBytes(upload.compressedSize)}</span>
              <span className="text-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                -{Math.round((1 - upload.compressedSize / upload.originalSize) * 100)}%
              </span>
            </>
          )}
        </div>

        {upload.status === 'success' && upload.url && (
          <div className="mt-2 flex items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={upload.url}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-[10px] text-slate-400 outline-none focus:border-blue-500/50 transition-colors"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => onShowQR(upload.url!)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 transition-colors"
              title="Show QR Code"
            >
              <QrCode className="w-3 h-3" />
            </button>
          </div>
        )}
        {upload.status === 'error' && (
          <p className="mt-1 text-[10px] text-red-400">{upload.error}</p>
        )}
      </div>
    </div>
  );
}
